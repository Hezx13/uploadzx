import type {
  PersistenceAdapter,
  StoredFileHandle,
  Uploader,
  UploadEvents,
  UploadFile,
  UploadOptions,
  UploadState,
  UploadDriver,
  ResumeData,
} from '../src/types';

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
  private resumeData?: ResumeData;
  static instances: FakeUploader[] = [];

  constructor(
    public file: UploadFile,
    public driver: UploadDriver,
    public events: UploadEvents,
    resumeData?: ResumeData,
    bytesUploaded?: number
  ) {
    this.resumeData = resumeData;
    this.state = {
      fileId: file.id,
      status: resumeData ? 'paused' : 'pending',
      file: file.file,
      progress: {
        fileId: file.id,
        bytesUploaded: bytesUploaded ?? 0,
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
  getResumeData(): ResumeData | undefined {
    return this.resumeData;
  }
  canResume(): boolean {
    return this.state.status === 'paused' || this.state.status === 'error';
  }

  // --- test drivers ---
  progress(bytes: number): void {
    this.resumeData = this.resumeData ?? { uploadUrl: 'https://tus.example/upload/1' };
    this.state = {
      ...this.state,
      progress: { ...this.state.progress, bytesUploaded: bytes },
    };
    this.events.onProgress?.(this.state.progress);
    this.events.onStateChange?.(this.state);
  }
  complete(url = 'https://tus.example/upload/1'): void {
    this.resumeData = { uploadUrl: url };
    this.setStatus('completed', { url });
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
  return ({
    file,
    driver,
    events,
    resumeData,
    bytesUploaded,
  }: {
    file: UploadFile;
    driver: UploadDriver;
    events: UploadEvents;
    resumeData?: ResumeData;
    bytesUploaded?: number;
    trackSpeed?: boolean;
  }): Uploader => new FakeUploader(file, driver, events, resumeData, bytesUploaded);
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
    resumeData: ResumeData | undefined,
    bytesUploaded: number
  ): Promise<void> {
    const r = this.records.get(id);
    if (r) this.records.set(id, { ...r, resumeData, bytesUploaded });
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
