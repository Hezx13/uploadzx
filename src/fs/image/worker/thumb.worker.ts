import type { ThumbWorkerRequest, ThumbWorkerResponse } from './protocol';

async function generateThumb(
  file: File,
  maxSize: number,
  format: 'webp' | 'jpeg'
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('OffscreenCanvas 2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mime = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const blob = await canvas.convertToBlob({ type: mime, quality: 0.85 });
  return blob;
}

self.onmessage = async (event: MessageEvent<ThumbWorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'dispose') {
    return;
  }

  try {
    const blob = await generateThumb(msg.file, msg.maxSize, msg.format);
    const response: ThumbWorkerResponse = { type: 'result', id: msg.id, blob };
    self.postMessage(response);
  } catch (error) {
    const response: ThumbWorkerResponse = {
      type: 'error',
      id: msg.id,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
