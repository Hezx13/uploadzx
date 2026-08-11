---
title: Type reference
description: The most-used exported types.
---

Everything below is exported from both `uploadzx` and (re-exported) from
`uploadzx/react`.

```ts
interface UploadFile {
  id: string;
  file: File;
  fileHandle?: FileSystemFileHandle;
  name: string;
  size: number;
  type: string;
}

interface UploadProgress {
  fileId: string;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;     // 0–100, two decimals
  bytesPerSecond: number; // 0 unless trackSpeed: true
}

type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

interface UploadState {
  fileId: string;
  status: UploadStatus;
  progress: UploadProgress;
  error?: Error;
  url?: string;
  file: File;
  integrity?: IntegrityDigest; // present once hashing completes (opt-in)
}

// Integrity hashing (opt-in) — see /docs/guides/integrity
type IntegrityAlgorithm = 'blake3' | 'sha-256';

interface IntegrityDigest {
  algorithm: IntegrityAlgorithm;
  hex: string; // lowercase-hex digest
}

interface IntegrityOptions {
  algorithm?: IntegrityAlgorithm; // default 'blake3'
  verifyResume?: boolean;         // default true
  sendToServer?: boolean;         // default true
  metadataKey?: string;           // default 'checksum'
  dedup?: boolean;                // default true
  chunkSize?: number;             // default 8 MiB
  workerFactory?: () => Worker;   // bundler escape hatch
  hasher?: IntegrityHasher;       // inject a custom hasher (tests)
}

// Headers/metadata can be static OR an (async) factory resolved per request.
type DynamicValue<T> = T | (() => T | Promise<T>);

interface FileValidationOptions {
  maxSize?: number;       // bytes, per file
  allowedTypes?: string[]; // MIME, supports 'image/*'
  maxFiles?: number;      // per addFiles() batch
}

interface StoredFileHandle {
  id: string;
  name: string;
  size: number;
  type: string;
  handle: FileSystemFileHandle;
  lastModified: number;
  resumeData?: ResumeData;
  bytesUploaded?: number;
  createdAt?: number;
  hash?: IntegrityDigest; // persisted digest, for resume verification
}
```

Extension-point interfaces (`UploadDriver`, `UploadSession`,
`PersistenceAdapter`, `Uploader`) are documented in
[Writing a driver](/docs/core/custom-driver) and
[Persistence](/docs/guides/persistence).
