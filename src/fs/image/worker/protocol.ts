export type ThumbWorkerRequest =
  | { type: 'generate'; id: string; file: File; maxSize: number; format: 'webp' | 'jpeg' }
  | { type: 'dispose' };

export type ThumbWorkerResponse =
  | { type: 'result'; id: string; blob: Blob }
  | { type: 'error'; id: string; message: string };
