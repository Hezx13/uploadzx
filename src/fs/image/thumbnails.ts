import type { FsStore } from '../store/FsStore';
import { generateFileId } from '../../utils';
import { thumbKeyFor } from '../utils';

export interface Thumbnailer {
  generate(file: File, opts?: ThumbnailOptions): Promise<Blob>;
}

export interface ThumbnailOptions {
  maxSize?: number;
  format?: 'webp' | 'jpeg';
}

export interface ThumbnailerOptions {
  maxSize?: number;
  format?: 'webp' | 'jpeg';
  workerFactory?: () => Worker;
}

const DEFAULT_MAX_SIZE = 256;

export function createThumbnailer(options: ThumbnailerOptions = {}): Thumbnailer {
  // Worker mode is opt-in via `workerFactory`. We intentionally do NOT reference
  // a bundled worker via `new Worker(new URL(...))` here: that path is rewritten
  // by bundlers (Vite/Rollup) and breaks consumers who only use the rest of the
  // module. Without a factory we fall back to the main-thread thumbnailer.
  if (options.workerFactory && typeof OffscreenCanvas !== 'undefined') {
    return new WorkerThumbnailer(options);
  }
  return new MainThreadThumbnailer(options);
}

export class ThumbnailCache {
  constructor(
    private store: FsStore,
    private thumbnailer: Thumbnailer
  ) {}

  async getOrCreate(recordId: string, file: File, opts?: ThumbnailOptions): Promise<Blob> {
    const thumbKey = thumbKeyFor(recordId);
    const cached = await this.store.getThumb(thumbKey);
    if (cached) return cached;

    const blob = await this.thumbnailer.generate(file, opts);
    await this.store.putThumb(thumbKey, blob);
    return blob;
  }

  async invalidate(recordId: string): Promise<void> {
    await this.store.removeThumb(thumbKeyFor(recordId));
  }
}

class WorkerThumbnailer implements Thumbnailer {
  private worker: Worker;
  private pending = new Map<
    string,
    { resolve: (b: Blob) => void; reject: (e: Error) => void }
  >();
  private maxSize: number;
  private format: 'webp' | 'jpeg';

  constructor(options: ThumbnailerOptions) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.format = options.format ?? 'webp';
    if (!options.workerFactory) {
      throw new Error(
        'uploadzx/fs: WorkerThumbnailer requires options.workerFactory. ' +
          'Provide a factory that returns a Worker built from ' +
          'uploadzx/fs/image/worker/thumb.worker, or use the main-thread thumbnailer.'
      );
    }
    this.worker = options.workerFactory();

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'result') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.resolve(msg.blob);
        }
      } else if (msg.type === 'error') {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.reject(new Error(msg.message));
        }
      }
    };

    // Without these, a crashed/misconfigured worker leaves every pending
    // `generate()` call unresolved forever — reject them all instead.
    this.worker.onerror = (event: ErrorEvent) => {
      this.rejectAllPending(
        new Error(`uploadzx/fs: thumbnail worker crashed: ${event.message}`)
      );
    };
    this.worker.onmessageerror = () => {
      this.rejectAllPending(
        new Error('uploadzx/fs: thumbnail worker received a non-clonable message')
      );
    };
  }

  private rejectAllPending(error: Error): void {
    for (const p of this.pending.values()) {
      p.reject(error);
    }
    this.pending.clear();
  }

  generate(file: File, opts?: ThumbnailOptions): Promise<Blob> {
    const id = generateFileId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        type: 'generate',
        id,
        file,
        maxSize: opts?.maxSize ?? this.maxSize,
        format: opts?.format ?? this.format,
      });
    });
  }

  dispose(): void {
    this.worker.postMessage({ type: 'dispose' });
    this.worker.terminate();
  }
}

class MainThreadThumbnailer implements Thumbnailer {
  private maxSize: number;
  private format: 'webp' | 'jpeg';

  constructor(options: ThumbnailerOptions) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.format = options.format ?? 'webp';
  }

  async generate(file: File, opts?: ThumbnailOptions): Promise<Blob> {
    const maxSize = opts?.maxSize ?? this.maxSize;
    const format = opts?.format ?? this.format;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas 2d context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create thumbnail blob'));
        },
        mime,
        0.85
      );
    });
  }
}
