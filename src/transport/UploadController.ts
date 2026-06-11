import {
  UploadFile,
  UploadOptions,
  UploadEvents,
  UploadState,
  UploadProgress,
  Uploader,
  IntegrityDigest,
} from '../types';
import { UploadDriver, UploadSession, ResumeData, UploadResult } from './types';
import { ProgressTracker } from './ProgressTracker';
import { UploadStateMachine } from './UploadStateMachine';
import { CheckpointStore } from './CheckpointStore';
import { createLogger, Logger } from '../utils';
import type { IntegrityCoordinator } from '../integrity/IntegrityCoordinator';

export interface UploadControllerOptions {
  trackSpeed?: boolean;
  logger?: Logger;
  /** Enables the pre-upload integrity-hashing stage when provided. */
  integrity?: { coordinator: IntegrityCoordinator };
}

/** Minimum interval between progress event emissions, to avoid flooding listeners. */
const PROGRESS_EMIT_INTERVAL_MS = 100;

/**
 * Generic upload engine that coordinates a single file's transfer.
 *
 * It does not *implement* state management, progress math, or resume bookkeeping
 * itself — it delegates those to collaborators ({@link UploadStateMachine},
 * {@link ProgressTracker}, {@link CheckpointStore}) and confines its own job to
 * driving the driver session through the lifecycle and wiring the pieces
 * together. Transport-agnostic: works with tus, S3, Azure, HTTP PUT, or any driver.
 */
export class UploadController implements Uploader {
  private readonly uploadFile: UploadFile;
  private readonly driver: UploadDriver;
  private readonly events: UploadEvents;
  private readonly logger: Logger;
  private readonly machine: UploadStateMachine;
  private readonly progressTracker: ProgressTracker;
  private readonly checkpoints = new CheckpointStore();

  private abortController: AbortController;
  private session?: UploadSession;
  private lastProgressEmit = 0;
  private readonly integrity?: { coordinator: IntegrityCoordinator };
  private integrityDigest?: IntegrityDigest;

  constructor(
    uploadFile: UploadFile,
    options: UploadOptions,
    driver: UploadDriver,
    events: UploadEvents = {},
    controllerOptions?: UploadControllerOptions
  ) {
    this.uploadFile = uploadFile;
    this.driver = driver;
    this.events = events;
    this.abortController = new AbortController();
    this.logger = controllerOptions?.logger ?? createLogger(options.debug, options.logger);

    this.machine = new UploadStateMachine(
      {
        fileId: uploadFile.id,
        status: 'pending',
        file: uploadFile.file,
        progress: {
          fileId: uploadFile.id,
          bytesUploaded: 0,
          bytesTotal: uploadFile.size,
          percentage: 0,
          bytesPerSecond: 0,
        },
      },
      state => this.events.onStateChange?.(state)
    );

    this.progressTracker = new ProgressTracker(controllerOptions?.trackSpeed ?? false);
    this.integrity = controllerOptions?.integrity;
  }

  /**
   * Initialize the controller with prior resume data and bytes.
   * Called when resuming a paused/failed upload from storage.
   *
   * `digest` seeds a previously-computed (and, on resume, already-verified)
   * content digest so the upload doesn't re-hash on start.
   */
  setResumeState(
    resumeData: ResumeData | undefined,
    bytesUploaded: number,
    digest?: IntegrityDigest
  ): void {
    this.checkpoints.hydrate(resumeData, bytesUploaded);

    if (digest) {
      this.integrityDigest = digest;
      this.integrity?.coordinator.seed(this.uploadFile.id, digest);
    }

    const state = this.machine.getState();
    this.machine.hydrate({
      ...state,
      status: resumeData ? 'paused' : 'pending',
      integrity: digest ?? state.integrity,
      progress: {
        ...state.progress,
        bytesUploaded,
        percentage: this.toPercentage(bytesUploaded),
      },
    });
  }

  async start(): Promise<void> {
    if (this.machine.status === 'uploading') {
      return;
    }
    // Illegal from a terminal state (completed/cancelled); bail without starting.
    if (!this.machine.transition('uploading')) {
      return;
    }

    this.progressTracker.initialize(this.checkpoints.bytes);
    this.lastProgressEmit = 0;

    try {
      if (this.integrity) {
        const outcome = await this.runIntegrityStage();
        // Aborted (pause/cancel during hashing) or skipped as a duplicate —
        // either way there is no transfer to start.
        if (outcome !== 'ok') {
          return;
        }
      }

      this.session = this.driver.createSession(
        {
          fileId: this.uploadFile.id,
          file: this.uploadFile.file,
          name: this.uploadFile.name,
          size: this.uploadFile.size,
          type: this.uploadFile.type,
          resume: this.checkpoints.resume,
          signal: this.abortController.signal,
          logger: this.logger,
          integrity: this.buildIntegrityContext(),
        },
        {
          onProgress: bytes => this.handleProgress(bytes),
          onCheckpoint: data => this.checkpoints.capture(data),
          onSuccess: result => this.handleSuccess(result),
        }
      );

      // A session reports failure solely by rejecting; this is the single error
      // path. handleError() ignores errors raised while paused/cancelled (e.g.
      // an abort triggered by pause/cancel) via the state machine's guards.
      await this.session.start();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  async pause(): Promise<void> {
    // Mark paused first so the abort-driven rejection from the in-flight session
    // is recognised as an intentional pause rather than a failure.
    if (!this.machine.transition('paused')) {
      return;
    }

    try {
      // Give the driver a chance to flush its resume checkpoint before we tear
      // the transfer down. Resumable drivers persist their checkpoint here; this
      // is what makes a paused upload actually resumable.
      await this.session?.pause();
      this.abortController.abort();
      this.progressTracker.reset();
    } catch (error) {
      this.logger.error('Error pausing upload:', error);
    }
  }

  async resume(): Promise<void> {
    if (this.machine.status !== 'paused' && this.machine.status !== 'error') {
      return;
    }

    // Non-resumable transports cannot continue from a checkpoint, so a "resume"
    // is honestly a restart from byte 0. Reset progress so the UI doesn't report
    // a stale, half-complete position that the transport will never honour.
    if (!this.driver.resumable) {
      this.checkpoints.clear();
      this.machine.setProgress(this.makeProgress(0, 0, 0), true);
    }

    this.logger.debug(
      `Resuming upload for file: ${this.uploadFile.name}, bytesUploaded: ${this.checkpoints.bytes}`
    );
    this.abortController = new AbortController();
    await this.start();
  }

  async cancel(): Promise<void> {
    if (!this.machine.transition('cancelled')) {
      return;
    }

    this.abortController.abort();
    this.checkpoints.clear();
    this.progressTracker.reset();
    this.integrity?.coordinator.forget(this.uploadFile.id);
    this.events.onCancel?.(this.uploadFile.id);
  }

  getState(): UploadState {
    return this.machine.getState();
  }

  getResumeData(): ResumeData | undefined {
    return this.checkpoints.resume;
  }

  canResume(): boolean {
    // Only resumable transports can genuinely continue from a checkpoint.
    return (
      this.driver.resumable && (this.machine.status === 'paused' || this.machine.status === 'error')
    );
  }

  private handleProgress(bytesUploaded: number): void {
    this.checkpoints.recordBytes(bytesUploaded);

    const snapshot = this.progressTracker.updateProgress(bytesUploaded, this.uploadFile.size);
    const progress: UploadProgress = { ...snapshot, fileId: this.uploadFile.id };

    // Always keep internal state current, but coalesce outward emission so a
    // chatty transport doesn't flood listeners (and React re-renders). The final
    // 100% tick is always emitted.
    const now = Date.now();
    const isComplete = bytesUploaded >= this.uploadFile.size;
    const emit = isComplete || now - this.lastProgressEmit >= PROGRESS_EMIT_INTERVAL_MS;
    if (emit) {
      this.lastProgressEmit = now;
    }

    this.machine.setProgress(progress, emit);
    if (emit) {
      this.events.onProgress?.(progress);
    }
  }

  private handleSuccess(result: UploadResult): void {
    if (!this.machine.transition('completed', { url: result.url })) {
      return;
    }
    this.events.onComplete?.(this.uploadFile.id, result.url || '');
    this.progressTracker.reset();
  }

  private handleError(error: Error): void {
    // An illegal transition here means the error arrived after an intentional
    // pause/cancel (or post-completion) — not a real failure, so ignore it.
    if (!this.machine.transition('error', { error })) {
      return;
    }
    this.events.onError?.(this.uploadFile.id, error);
    this.progressTracker.reset();
  }

  getIntegrity(): IntegrityDigest | undefined {
    return this.integrityDigest;
  }

  /**
   * Pre-upload hashing pass. Computes (or reuses) the file's content digest,
   * publishes it to state/events, and short-circuits the upload if the digest
   * matches an already-completed one (dedup).
   *
   * Returns `'aborted'` when a pause/cancel interrupts hashing, `'deduplicated'`
   * when the file was skipped as a duplicate, and `'ok'` to proceed with the
   * transfer. Real hashing failures are thrown for the caller's error handler.
   */
  private async runIntegrityStage(): Promise<'ok' | 'aborted' | 'deduplicated'> {
    if (!this.integrity) return 'ok';
    const { coordinator } = this.integrity;
    const opts = coordinator.resolvedOptions;

    let digest = this.integrityDigest ?? coordinator.getCached(this.uploadFile.id);
    if (!digest) {
      try {
        digest = await coordinator.getDigest(this.uploadFile.id, this.uploadFile.file, {
          signal: this.abortController.signal,
        });
      } catch (error) {
        // A pause/cancel aborts the hash; that's an intentional stop, not a failure.
        if (this.abortController.signal.aborted) {
          return 'aborted';
        }
        throw error;
      }
    }

    // A pause/cancel may have arrived after the hash resolved.
    if (this.abortController.signal.aborted) {
      return 'aborted';
    }

    this.integrityDigest = digest;
    this.machine.setIntegrity(digest);
    this.events.onHash?.(this.uploadFile.id, digest);

    if (opts.dedup) {
      const duplicate = coordinator.findCompleted(digest.hex);
      if (duplicate) {
        this.logger.debug(`Skipping duplicate upload for ${this.uploadFile.name}`);
        this.handleSuccess({ url: duplicate.url });
        return 'deduplicated';
      }
    }

    return 'ok';
  }

  /** Build the per-file integrity context handed to the driver, if enabled. */
  private buildIntegrityContext(): { digest: IntegrityDigest; metadataKey: string } | undefined {
    if (!this.integrity || !this.integrityDigest) return undefined;
    const opts = this.integrity.coordinator.resolvedOptions;
    if (!opts.sendToServer) return undefined;
    return { digest: this.integrityDigest, metadataKey: opts.metadataKey };
  }

  private makeProgress(
    bytesUploaded: number,
    percentage: number,
    bytesPerSecond: number
  ): UploadProgress {
    return {
      fileId: this.uploadFile.id,
      bytesUploaded,
      bytesTotal: this.uploadFile.size,
      percentage,
      bytesPerSecond,
    };
  }

  /** Two-decimal percentage, matching the tracker so the UI doesn't snap. */
  private toPercentage(bytesUploaded: number): number {
    return this.uploadFile.size > 0
      ? Number(((bytesUploaded / this.uploadFile.size) * 100).toFixed(2))
      : 0;
  }
}
