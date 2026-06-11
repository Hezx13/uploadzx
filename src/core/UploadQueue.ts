import {
  UploadFile,
  UploadOptions,
  UploadEvents,
  UploadEventMap,
  UploadState,
  StoredFileHandle,
  Uploader,
  PersistenceAdapter,
  QueueOptions,
  UploadDriver,
  ResumeData,
  IntegrityDigest,
} from '../types';
import { createLogger, isBrowser, Logger, TypedEmitter, validateFile } from '../utils';
import { UploadController } from '../transport/UploadController';
import { FileHandleStore } from './FileHandleStore';
import { IntegrityCoordinator, resolveIntegrityOptions } from '../integrity/IntegrityCoordinator';

export interface UploaderFactoryParams {
  file: UploadFile;
  driver: UploadDriver;
  events: UploadEvents;
  resumeData?: ResumeData;
  bytesUploaded?: number;
  trackSpeed?: boolean;
  /** A previously-computed (verified) content digest to seed on resume. */
  digest?: IntegrityDigest;
}

export type UploaderFactory = (params: UploaderFactoryParams) => Uploader;

export interface UploadQueueConstructorOptions extends QueueOptions {
  /** Inject an alternative uploader factory for testing. */
  uploaderFactory?: UploaderFactory;
}

/** Minimum interval between IndexedDB progress writes, per file. */
const PROGRESS_PERSIST_INTERVAL_MS = 1000;

/** Default TTL for persisted upload records: 7 days. */
const DEFAULT_PERSISTENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class UploadQueue {
  private options: UploadQueueConstructorOptions;
  private emitter = new TypedEmitter<UploadEventMap>();
  private logger: Logger;
  private uploaderFactory: UploaderFactory;
  private uploaders: Map<string, Uploader> = new Map();
  private unfinishedUploads: Map<string, StoredFileHandle> = new Map();
  private queue: string[] = [];
  private activeUploads: Set<string> = new Set();
  private isInitialized: boolean = false;
  private lastPersist: Map<string, number> = new Map();
  public fileHandleStore: PersistenceAdapter;
  /** Present only when integrity hashing is enabled via options. */
  private coordinator?: IntegrityCoordinator;

  /** Resolves when the queue has loaded any prior unfinished uploads; rejects on init failure. */
  public readonly ready: Promise<void>;

  constructor(options: UploadQueueConstructorOptions, events: UploadEvents = {}) {
    this.options = {
      maxConcurrent: 3,
      autoStart: false,
      autoEvictCompleted: true,
      ...options,
    };
    this.registerEvents(events);
    this.logger = createLogger(options.debug, options.logger);
    this.fileHandleStore = options.store ?? new FileHandleStore(this.logger);

    this.uploaderFactory =
      options.uploaderFactory ??
      (({ file, driver, events: evts, resumeData, bytesUploaded, trackSpeed, digest }) => {
        // Pass only what the controller actually consumes, not the full queue config.
        const controller = new UploadController(
          file,
          { debug: this.options.debug, logger: this.options.logger },
          driver,
          evts,
          {
            trackSpeed: trackSpeed ?? false,
            logger: this.logger,
            integrity: this.coordinator ? { coordinator: this.coordinator } : undefined,
          }
        );
        if (resumeData !== undefined || bytesUploaded !== undefined || digest !== undefined) {
          controller.setResumeState(resumeData, bytesUploaded || 0, digest);
        }
        return controller;
      });

    this.ready = this.initialize();
    // Mark as handled so a consumer that never awaits `ready` doesn't trigger
    // an unhandledrejection; explicit awaiters still observe the rejection.
    this.ready.catch(() => {});
  }

  private async initialize(): Promise<void> {
    await this.setupIntegrity();

    // No persistent storage outside the browser (SSR) — initialize as an empty,
    // ready queue rather than throwing on `indexedDB`.
    if (!isBrowser()) {
      this.isInitialized = true;
      this.options.onInit?.();
      return;
    }
    try {
      const ttl = this.options.persistenceTtlMs ?? DEFAULT_PERSISTENCE_TTL_MS;
      if (ttl > 0 && this.fileHandleStore.reapStale) {
        await this.fileHandleStore.reapStale(ttl);
      }
      await this.getUnfinishedUploadsFromStore();
      this.isInitialized = true;
      this.options.onInit?.();
    } catch (error) {
      this.logger.error('Failed to initialize UploadQueue:', error);
      // Still notify legacy onInit listeners, but surface the failure on `ready`.
      this.options.onInit?.();
      throw error;
    }
  }

  /**
   * Build the integrity coordinator when `integrity` is configured. The
   * worker-backed wasm hasher is imported lazily from the `uploadzx/integrity`
   * subpath so it never enters the core bundle; an injected `hasher` (e.g. in
   * tests) skips the dynamic import entirely.
   */
  private async setupIntegrity(): Promise<void> {
    const integrityOptions = this.options.integrity;
    if (!integrityOptions) return;

    const resolved = resolveIntegrityOptions(integrityOptions);
    let hasher = integrityOptions.hasher;
    if (!hasher) {
      const integrity = await import('uploadzx/integrity');
      hasher = new integrity.HashWorkerClient({ workerFactory: integrityOptions.workerFactory });
    }
    this.coordinator = new IntegrityCoordinator(hasher, resolved);
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /** Subscribe to a queue event. Returns an unsubscribe function. */
  on<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): () => void {
    return this.emitter.on(event, listener);
  }

  /** Subscribe to a single occurrence of a queue event. */
  once<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): () => void {
    return this.emitter.once(event, listener);
  }

  /** Remove a previously registered listener. */
  off<K extends keyof UploadEventMap>(event: K, listener: UploadEventMap[K]): void {
    this.emitter.off(event, listener);
  }

  /** Bridges the legacy single-callback `UploadEvents` bag onto the emitter. */
  private registerEvents(events: UploadEvents): void {
    if (events.onProgress) this.emitter.on('progress', events.onProgress);
    if (events.onStateChange) this.emitter.on('stateChange', events.onStateChange);
    if (events.onComplete) this.emitter.on('complete', events.onComplete);
    if (events.onError) this.emitter.on('error', events.onError);
    if (events.onCancel) this.emitter.on('cancel', events.onCancel);
    if (events.onHash) this.emitter.on('hash', events.onHash);
  }

  private buildEvents(): UploadEvents {
    return {
      onProgress: progress => this.emitter.emit('progress', progress),
      onStateChange: state => this.handleStateChange(state),
      onComplete: (fileId, url) => {
        this.handleComplete(fileId, url);
        void this.fileHandleStore.removeFileHandle(fileId);
      },
      onError: (fileId, error) => this.handleError(fileId, error),
      // Surfaced once when the uploader actually transitions to cancelled.
      onCancel: fileId => this.emitter.emit('cancel', fileId),
      onHash: (fileId, digest) => this.emitter.emit('hash', fileId, digest),
    };
  }

  async addFiles(files: UploadFile[]): Promise<UploadFile[]> {
    const validation = this.options.validation;

    if (validation?.maxFiles && files.length > validation.maxFiles) {
      const error = new Error(
        `Too many files: ${files.length} exceeds maximum of ${validation.maxFiles}`
      );
      files.forEach(f => this.emitter.emit('error', f.id, error));
      return [];
    }

    const accepted: UploadFile[] = [];

    for (const file of files) {
      if (validation) {
        const reason = validateFile(file.file, {
          maxSize: validation.maxSize,
          allowedTypes: validation.allowedTypes,
        });
        if (reason) {
          this.logger.warn(`Rejected "${file.name}": ${reason}`);
          this.emitter.emit('error', file.id, new Error(reason));
          continue;
        }
      }

      if (file.fileHandle) {
        try {
          await this.fileHandleStore.storeFileHandle(file.fileHandle, file.id);
        } catch (error) {
          // e.g. insufficient storage quota — reject this file, keep the batch.
          this.logger.warn(`Could not persist "${file.name}":`, error);
          this.emitter.emit('error', file.id, error as Error);
          continue;
        }
      }

      const uploader = this.uploaderFactory({
        file,
        driver: this.options.driver,
        events: this.buildEvents(),
        resumeData: undefined,
        bytesUploaded: 0,
        trackSpeed: this.options.trackSpeed,
      });
      this.uploaders.set(file.id, uploader);
      this.queue.push(file.id);
      accepted.push(file);
    }

    if (this.options.autoStart) {
      this.processQueue();
    }
    return accepted;
  }

  async startQueue(): Promise<void> {
    this.processQueue();
  }

  async pauseAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      await uploader.pause();
      await this.persistProgress(uploader, true);
    }
  }

  async resumeAll(): Promise<void> {
    for (const [fileId, uploader] of this.uploaders) {
      if (uploader.getState().status === 'paused') {
        this.enqueue(fileId);
      }
    }
    this.processQueue();
  }

  async cancelAll(): Promise<void> {
    for (const uploader of this.uploaders.values()) {
      await uploader.cancel();
    }
    this.activeUploads.clear();
    this.queue.length = 0;
    this.lastPersist.clear();
    await this.fileHandleStore.clear();
  }

  async pauseUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.pause();
      this.activeUploads.delete(fileId);
      await this.persistProgress(uploader, true);
      this.processQueue();
    }
  }

  async resumeUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader && uploader.getState().status === 'paused') {
      this.enqueue(fileId);
      this.processQueue();
    }
  }

  async cancelUpload(fileId: string): Promise<void> {
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      await uploader.cancel();
      this.activeUploads.delete(fileId);
      this.removeFromQueue(fileId);
      this.lastPersist.delete(fileId);
      this.processQueue();
      await this.fileHandleStore.removeFileHandle(fileId);
    }
  }

  clearCompletedUploads(): void {
    for (const [fileId, uploader] of this.uploaders) {
      const status = uploader.getState().status;
      if (status === 'completed' || status === 'cancelled') {
        this.uploaders.delete(fileId);
        this.lastPersist.delete(fileId);
      }
    }
  }

  getUploadState(fileId: string): UploadState | null {
    const uploader = this.uploaders.get(fileId);
    return uploader ? uploader.getState() : null;
  }

  getAllStates(): UploadState[] {
    return Array.from(this.uploaders.values()).map(uploader => uploader.getState());
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeUploads.size;
  }

  async getUnfinishedUploads(): Promise<StoredFileHandle[]> {
    return Array.from(this.unfinishedUploads.values());
  }

  async restoreUnfinishedUpload(fileHandleOrId: StoredFileHandle | string): Promise<void> {
    return this.resumeUnfinishedUpload(fileHandleOrId);
  }

  /**
   * Detach all event listeners. Does not cancel in-flight uploads; it only stops
   * this queue from emitting into now-stale subscribers.
   */
  destroy(): void {
    this.emitter.removeAll();
    this.coordinator?.dispose();
  }

  /** Adds a file id to the pending queue if it isn't already queued. */
  private enqueue(fileId: string): void {
    if (!this.queue.includes(fileId) && !this.activeUploads.has(fileId)) {
      this.queue.push(fileId);
    }
  }

  /** Persists upload progress to storage, throttled per file unless forced. */
  private async persistProgress(uploader: Uploader, force = false): Promise<void> {
    const fileId = uploader.getState().fileId;
    const now = Date.now();
    const last = this.lastPersist.get(fileId) ?? 0;
    if (!force && now - last < PROGRESS_PERSIST_INTERVAL_MS) {
      return;
    }
    this.lastPersist.set(fileId, now);
    await this.updateStoredFileHandleProgress(uploader);
  }

  private async updateStoredFileHandleProgress(uploader: Uploader): Promise<void> {
    const state = uploader.getState();
    const resumeData = uploader.getResumeData();
    const digest = uploader.getIntegrity?.();

    if (resumeData && state.progress.bytesUploaded > 0) {
      const storedHandle = this.unfinishedUploads.get(state.fileId);
      if (storedHandle) {
        const updatedHandle: StoredFileHandle = {
          ...storedHandle,
          resumeData,
          bytesUploaded: state.progress.bytesUploaded,
          hash: digest ?? storedHandle.hash,
        };
        this.unfinishedUploads.set(state.fileId, updatedHandle);
      }
      await this.fileHandleStore.updateFileHandleProgress(
        state.fileId,
        resumeData,
        state.progress.bytesUploaded,
        digest
      );
    }
  }

  private processQueue(): void {
    const maxConcurrent = this.options.maxConcurrent || 3;

    while (this.queue.length > 0 && this.activeUploads.size < maxConcurrent) {
      const fileId = this.queue.shift();
      if (!fileId) continue;

      const uploader = this.uploaders.get(fileId);
      if (!uploader) continue;

      const status = uploader.getState().status;
      if (status === 'pending') {
        this.activeUploads.add(fileId);
        uploader.start().catch(() => {
          /* handled in onError */
        });
      } else if (status === 'paused') {
        this.activeUploads.add(fileId);
        uploader.resume().catch(() => {
          /* handled in onError */
        });
      }
    }
  }

  private handleStateChange(state: UploadState): void {
    if (state.status === 'uploading' || state.status === 'paused') {
      const uploader = this.uploaders.get(state.fileId);
      if (uploader) {
        // Throttled while uploading; forced on pause to capture the final offset.
        void this.persistProgress(uploader, state.status === 'paused');
      }
    }

    this.emitter.emit('stateChange', state);
  }

  private handleComplete(fileId: string, url: string): void {
    // Record the digest before any eviction so later duplicates can be skipped.
    if (this.coordinator) {
      const digest = this.uploaders.get(fileId)?.getIntegrity?.();
      if (digest) {
        this.coordinator.markCompleted(digest, fileId, url);
      }
    }

    this.activeUploads.delete(fileId);
    this.unfinishedUploads.delete(fileId);
    this.lastPersist.delete(fileId);
    this.emitter.emit('complete', fileId, url);
    // Release the completed uploader (and the File it pins) unless the consumer
    // opted to retain it for later querying via getAllStates().
    if (this.options.autoEvictCompleted) {
      this.uploaders.delete(fileId);
    }
    this.processQueue();
  }

  private handleError(fileId: string, error: Error): void {
    this.activeUploads.delete(fileId);
    const uploader = this.uploaders.get(fileId);
    if (uploader) {
      // Force-persist on error so the upload can be resumed later.
      void this.persistProgress(uploader, true);
    }
    this.emitter.emit('error', fileId, error);
    this.processQueue();
  }

  private removeFromQueue(fileId: string): void {
    const index = this.queue.indexOf(fileId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  private async getUnfinishedUploadsFromStore(): Promise<void> {
    const fileHandles = await this.fileHandleStore.getAllFileHandles();

    this.unfinishedUploads = new Map(
      fileHandles
        .filter(fileHandle => !this.activeUploads.has(fileHandle.id))
        .map(fileHandle => [fileHandle.id, fileHandle])
    );
  }

  private async resumeUnfinishedUpload(fileHandleOrId: StoredFileHandle | string): Promise<void> {
    let id: string;
    let fileHandle: StoredFileHandle | undefined;

    if (typeof fileHandleOrId === 'string') {
      id = fileHandleOrId;
      fileHandle = this.unfinishedUploads.get(id);
    } else {
      id = fileHandleOrId.id;
      fileHandle = fileHandleOrId;
    }

    if (!fileHandle) {
      this.logger.warn('restoreUnfinishedUpload: handle not found for', id);
      return;
    }

    const file = await this.fileHandleStore.getFileFromHandleByID(id);
    if (!file) {
      // Permission may simply be unavailable outside a user gesture — keep the
      // record so a later user-initiated retry can succeed.
      this.logger.warn('restoreUnfinishedUpload: file not currently available for', id);
      return;
    }

    // Guard against the file being swapped/edited under the same handle since we
    // last saw it. lastModified alone misses same-timestamp replacements, so we
    // also require the size to match before trusting a resume.
    if (file.lastModified !== fileHandle.lastModified || file.size !== fileHandle.size) {
      this.logger.warn(
        `File changed since last access: ${fileHandle.name}. Removing from storage.`
      );
      await this.fileHandleStore.removeFileHandle(fileHandle.id);
      this.unfinishedUploads.delete(fileHandle.id);
      return;
    }

    // Content-addressed verification: re-hash the restored file and compare to
    // the persisted digest. This catches same-size/same-mtime edits that the
    // cheap check above misses. Only runs when integrity + verifyResume are on
    // and a digest was persisted.
    if (this.coordinator?.resolvedOptions.verifyResume && fileHandle.hash) {
      try {
        const actual = await this.coordinator.computeDigest(file);
        if (actual.hex !== fileHandle.hash.hex || actual.algorithm !== fileHandle.hash.algorithm) {
          this.logger.warn(
            `Integrity mismatch on resume for ${fileHandle.name}. Removing from storage.`
          );
          await this.fileHandleStore.removeFileHandle(fileHandle.id);
          this.unfinishedUploads.delete(fileHandle.id);
          return;
        }
      } catch (error) {
        // Couldn't verify (e.g. read error) — keep the record for a later retry.
        this.logger.warn('Resume integrity check failed; deferring resume:', error);
        return;
      }
    }

    const uploader = this.uploaderFactory({
      file: {
        id: fileHandle.id,
        file,
        fileHandle: fileHandle.handle,
        name: fileHandle.name,
        size: fileHandle.size,
        type: fileHandle.type,
      },
      driver: this.options.driver,
      events: this.buildEvents(),
      resumeData: fileHandle.resumeData,
      bytesUploaded: fileHandle.bytesUploaded || 0,
      trackSpeed: this.options.trackSpeed,
      digest: fileHandle.hash,
    });

    this.uploaders.set(fileHandle.id, uploader);

    if (this.options.autoStart) {
      this.enqueue(fileHandle.id);
      this.processQueue();
    }
  }
}
