import type {
  PersistenceAdapter,
  StoredFileHandle,
  Uploader,
  UploadEvents,
  UploadFile,
  UploadOptions,
  UploadState,
} from '../src/types';
import type { TusUploaderOptions } from '../src/core/TusUploader';

export function makeUploadFile(overrides: Partial<UploadFile> = {}): UploadFile {
  const name = overrides.name ?? 'file.bin';
  const contents = 'x'.repeat(overrides.size ?? 1024);
  const file =
    overrides.file ??
    new File([contents], name, { type: overrides.type ?? 'application/octet-stream' });
  return {
    id: overrides.id ?? crypto.randomUUID(),
    file,
    name,
    size: overrides.size ?? file.size,
    type: overrides.type ?? file.type,
    fileHandle: overrides.fileHandle,
  };
}

/** A fully controllable Uploader for driving the queue's state machine in tests. */
export class FakeUploader implements Uploader {
  state: UploadState;
  private uploadUrl?: string;
  static instances: FakeUploader[] = [];

  constructor(
    public file: UploadFile,
    public options: UploadOptions,
    public events: UploadEvents,
    public tusOptions?: TusUploaderOptions
  ) {
    this.uploadUrl = tusOptions?.previousUploadUrl;
    this.state = {
      fileId: file.id,
      status: tusOptions?.previousUploadUrl ? 'paused' : 'pending',
      file: file.file,
      progress: {
        fileId: file.id,
        bytesUploaded: tusOptions?.previousBytesUploaded ?? 0,
        bytesTotal: file.size,
        percentage: 0,
        bytesPerSecond: 0,
      },
    };
    FakeUploader.instances.push(this);
  }

  async start(): Promise<void> {
    this.setStatus('uploading');
  }
  async pause(): Promise<void> {
    this.setStatus('paused');
  }
  async resume(): Promise<void> {
    this.setStatus('uploading');
  }
  async cancel(): Promise<void> {
    if (this.state.status === 'cancelled') return;
    this.setStatus('cancelled');
    this.events.onCancel?.(this.file.id);
  }
  getState(): UploadState {
    return { ...this.state };
  }
  getCurrentUploadUrl(): string | undefined {
    return this.uploadUrl;
  }
  canResume(): boolean {
    return this.state.status === 'paused' || this.state.status === 'error';
  }

  // --- test drivers ---
  progress(bytes: number): void {
    this.uploadUrl = this.uploadUrl ?? 'https://tus.example/upload/1';
    this.state = {
      ...this.state,
      progress: { ...this.state.progress, bytesUploaded: bytes },
    };
    this.events.onProgress?.(this.state.progress);
    this.events.onStateChange?.(this.state);
  }
  complete(url = 'https://tus.example/upload/1'): void {
    this.uploadUrl = url;
    this.setStatus('completed', { tusUrl: url });
    this.events.onComplete?.(this.file.id, url);
  }
  fail(error: Error): void {
    this.setStatus('error', { error });
    this.events.onError?.(this.file.id, error);
  }

  private setStatus(status: UploadState['status'], extra: Partial<UploadState> = {}): void {
    this.state = { ...this.state, status, ...extra };
    this.events.onStateChange?.(this.state);
  }
}

export function fakeUploaderFactory() {
  FakeUploader.instances = [];
  return (
    file: UploadFile,
    options: UploadOptions,
    events: UploadEvents,
    tusOptions?: TusUploaderOptions
  ): Uploader => new FakeUploader(file, options, events, tusOptions);
}

/** A trivial in-memory PersistenceAdapter for queue tests that need storage. */
export class InMemoryStore implements PersistenceAdapter {
  records = new Map<string, StoredFileHandle>();
  files = new Map<string, File>();

  async storeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
    const file = await fileHandle.getFile();
    this.records.set(id, {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      handle: fileHandle,
      lastModified: file.lastModified,
      createdAt: Date.now(),
    });
    this.files.set(id, file);
  }
  async getFileHandle(id: string): Promise<StoredFileHandle | null> {
    return this.records.get(id) ?? null;
  }
  async getAllFileHandles(): Promise<StoredFileHandle[]> {
    return Array.from(this.records.values());
  }
  async removeFileHandle(id: string): Promise<void> {
    this.records.delete(id);
    this.files.delete(id);
  }
  async updateFileHandleProgress(
    id: string,
    tusUploadUrl: string,
    bytesUploaded: number
  ): Promise<void> {
    const r = this.records.get(id);
    if (r) this.records.set(id, { ...r, tusUploadUrl, bytesUploaded });
  }
  async getFileFromHandleByID(id: string): Promise<File | null> {
    return this.files.get(id) ?? null;
  }
  async clear(): Promise<void> {
    this.records.clear();
    this.files.clear();
  }
}

/** Builds a mock FileSystemFileHandle backed by an in-memory File. */
export function mockHandle(file: File): FileSystemFileHandle {
  return {
    kind: 'file',
    name: file.name,
    getFile: async () => file,
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    isSameEntry: async () => false,
  } as unknown as FileSystemFileHandle;
}

/** Flushes pending microtasks so async queue work settles. */
export const tick = () => new Promise<void>(r => setTimeout(r, 0));
