declare module 'exifr' {
  export function parse(
    file: File | Blob | ArrayBuffer,
    options?: Record<string, unknown>
  ): Promise<Record<string, unknown> | undefined>;
}
