import type { ImageDimensions, ImageMetadata } from '../types';
import { isRawFileName, isImageMime } from '../utils';

export interface ExifrModule {
  parse(file: File, opts?: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
}

export interface MetadataReader {
  read(file: File): Promise<ImageMetadata>;
  readDimensions(file: File): Promise<ImageDimensions | undefined>;
}

export interface MetadataReaderOptions {
  /** Lazy loader for exifr. Defaults to dynamic import('exifr'). */
  exifrLoader?: () => Promise<ExifrModule>;
}

let defaultReader: ExifrMetadataReader | undefined;

export function createMetadataReader(options: MetadataReaderOptions = {}): MetadataReader {
  return new ExifrMetadataReader(options);
}

export function getDefaultMetadataReader(): MetadataReader {
  if (!defaultReader) {
    defaultReader = new ExifrMetadataReader();
  }
  return defaultReader;
}

class ExifrMetadataReader implements MetadataReader {
  private exifrLoader: () => Promise<ExifrModule>;
  private exifrPromise?: Promise<ExifrModule>;

  constructor(options: MetadataReaderOptions = {}) {
    this.exifrLoader =
      options.exifrLoader ??
      (() => import('exifr') as Promise<ExifrModule>);
  }

  private async getExifr(): Promise<ExifrModule> {
    if (!this.exifrPromise) {
      this.exifrPromise = this.exifrLoader();
    }
    return this.exifrPromise;
  }

  async read(file: File): Promise<ImageMetadata> {
    const isRaw = isRawFileName(file.name);
    const isImage = isImageMime(file.type) || isRaw;

    if (!isImage) {
      return { isRaw };
    }

    try {
      const exifr = await this.getExifr();
      const [exif, iptc, xmp] = await Promise.all([
        exifr.parse(file, { iptc: false, xmp: false }).catch(() => undefined),
        exifr.parse(file, { iptc: true, tiff: false, xmp: false }).catch(() => undefined),
        exifr.parse(file, { xmp: true, tiff: false, iptc: false }).catch(() => undefined),
      ]);

      const dimensions = await this.readDimensionsFromExif(file, exif);

      return {
        dimensions,
        exif: exif as Record<string, unknown> | undefined,
        iptc: iptc as Record<string, unknown> | undefined,
        xmp: xmp as Record<string, unknown> | undefined,
        isRaw,
      };
    } catch {
      const dimensions = await this.readDimensions(file);
      return { dimensions, isRaw };
    }
  }

  async readDimensions(file: File): Promise<ImageDimensions | undefined> {
    if (isRawFileName(file.name)) {
      return undefined;
    }
    try {
      if (typeof createImageBitmap !== 'undefined') {
        const bitmap = await createImageBitmap(file);
        const dims: ImageDimensions = {
          width: bitmap.width,
          height: bitmap.height,
        };
        bitmap.close();
        return dims;
      }
      return await this.readDimensionsViaImage(file);
    } catch {
      return undefined;
    }
  }

  private async readDimensionsFromExif(
    file: File,
    exif: Record<string, unknown> | undefined
  ): Promise<ImageDimensions | undefined> {
    if (exif) {
      const w = exif.ImageWidth ?? exif.ExifImageWidth;
      const h = exif.ImageHeight ?? exif.ExifImageHeight;
      const orientation = exif.Orientation as number | undefined;
      if (typeof w === 'number' && typeof h === 'number') {
        return { width: w, height: h, orientation };
      }
    }
    return this.readDimensions(file);
  }

  private readDimensionsViaImage(file: File): Promise<ImageDimensions | undefined> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.src = url;
    });
  }
}
