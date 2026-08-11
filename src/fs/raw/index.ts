export interface RawDecodeResult {
  width: number;
  height: number;
  /** RGBA pixel data */
  data: Uint8Array;
  colorSpace?: 'srgb' | 'linear';
}

export interface RawDecoder {
  /** Returns true if this decoder can handle the given file extension. */
  supports(fileName: string): boolean;
  decode(file: File): Promise<RawDecodeResult>;
  dispose?(): void;
}

export interface RawDecoderOptions {
  /** Custom wasm module URL or loader. */
  wasmLoader?: () => Promise<RawWasmModule>;
}

export interface RawWasmModule {
  decode(buffer: ArrayBuffer, fileName: string): Promise<RawDecodeResult>;
}

/**
 * Lazy RAW decoder backed by an injectable wasm module.
 * The core bundle does not ship wasm; consumers provide a loader or use a
 * separately built adapter from uploadzx/fs/raw.
 */
export class LazyRawDecoder implements RawDecoder {
  private wasmModule?: RawWasmModule;
  private wasmLoader?: () => Promise<RawWasmModule>;
  private loadPromise?: Promise<RawWasmModule>;

  private static readonly EXTENSIONS = [
    '.cr2',
    '.cr3',
    '.nef',
    '.arw',
    '.dng',
    '.raf',
    '.orf',
    '.rw2',
    '.pef',
    '.srw',
    '.raw',
  ];

  constructor(options: RawDecoderOptions = {}) {
    this.wasmLoader = options.wasmLoader;
  }

  supports(fileName: string): boolean {
    const dot = fileName.lastIndexOf('.');
    if (dot < 0) return false;
    return LazyRawDecoder.EXTENSIONS.includes(fileName.slice(dot).toLowerCase());
  }

  async decode(file: File): Promise<RawDecodeResult> {
    const module = await this.getModule();
    const buffer = await file.arrayBuffer();
    return module.decode(buffer, file.name);
  }

  dispose(): void {
    this.wasmModule = undefined;
    this.loadPromise = undefined;
  }

  private async getModule(): Promise<RawWasmModule> {
    if (this.wasmModule) return this.wasmModule;
    if (!this.loadPromise) {
      this.loadPromise = this.loadWasm();
    }
    this.wasmModule = await this.loadPromise;
    return this.wasmModule;
  }

  private async loadWasm(): Promise<RawWasmModule> {
    if (this.wasmLoader) {
      return this.wasmLoader();
    }
    throw new Error(
      'uploadzx/fs/raw: no wasm loader configured. ' +
        'Provide wasmLoader in RawDecoderOptions or use createStubRawDecoder for development.'
    );
  }
}

/** In-memory stub for tests and development without wasm. */
export function createStubRawDecoder(): RawDecoder {
  return {
    supports: (name: string) => name.toLowerCase().endsWith('.dng'),
    decode: async (file: File) => ({
      width: 100,
      height: 100,
      data: new Uint8Array(100 * 100 * 4),
      colorSpace: 'srgb',
    }),
  };
}

export function createRawDecoder(options: RawDecoderOptions = {}): RawDecoder {
  return new LazyRawDecoder(options);
}
