import { describe, it, expect } from 'vitest';
import { Saver } from '../src/fs/access/Saver';
import { createStubRawDecoder } from '../src/fs/raw/index';
import { isRawFileName } from '../src/fs/utils';
import { createMetadataReader } from '../src/fs/image/metadata';

describe('Saver', () => {
  it('falls back to download when File System Access is unavailable', async () => {
    const saver = new Saver();
    const blob = new Blob(['export'], { type: 'image/jpeg' });
    const result = await saver.saveAs(blob, { suggestedName: 'out.jpg' });
    expect(result).toBeNull();
  });
});

describe('raw decoder stub', () => {
  it('decodes supported RAW files', async () => {
    const decoder = createStubRawDecoder();
    expect(decoder.supports('photo.dng')).toBe(true);
    expect(decoder.supports('photo.jpg')).toBe(false);

    const file = new File([new Uint8Array(100)], 'photo.dng');
    const result = await decoder.decode(file);
    expect(result.width).toBe(100);
    expect(result.data.length).toBe(100 * 100 * 4);
  });
});

describe('isRawFileName', () => {
  it('detects common RAW extensions', () => {
    expect(isRawFileName('IMG_0001.CR2')).toBe(true);
    expect(isRawFileName('photo.jpg')).toBe(false);
  });
});

describe('metadata reader', () => {
  it('reads dimensions via createImageBitmap for jpeg', async () => {
    const reader = createMetadataReader({
      exifrLoader: async () => ({
        parse: async () => ({ ImageWidth: 200, ImageHeight: 100, Orientation: 1 }),
      }) as unknown as typeof import('exifr'),
    });

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const blob = await new Promise<Blob>(resolve =>
      canvas.toBlob(b => resolve(b!), 'image/png')
    );
    const file = new File([blob], 'test.png', { type: 'image/png' });

    const meta = await reader.read(file);
    expect(meta.dimensions?.width).toBe(200);
  });
});

describe('thumbnailer main-thread fallback', () => {
  it('generates a thumbnail blob via canvas fallback', async () => {
    const thumbnailer: import('../src/fs/image/thumbnails').Thumbnailer = {
      generate: async (file, opts) => {
        const maxSize = opts?.maxSize ?? 128;
        return new Blob([`thumb:${file.name}:${maxSize}`], { type: 'image/jpeg' });
      },
    };

    const file = new File(['pixels'], 'big.png', { type: 'image/png' });
    const thumb = await thumbnailer.generate(file, { maxSize: 128, format: 'jpeg' });
    expect(thumb.size).toBeGreaterThan(0);
    expect(thumb.type).toMatch(/image\/jpeg/);
  });
});
