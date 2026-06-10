---
title: Writing a driver
description: Implement the UploadDriver interface to upload anywhere.
---

Implement the `UploadDriver` interface to upload anywhere — S3 multipart, Azure
Blob, a bespoke chunked API — while keeping the queue, persistence, progress, and
React layers unchanged. A driver creates `UploadSession`s; the engine calls
`start()`/`pause()` and listens through the handlers.

```ts
import type {
  UploadDriver,
  UploadDriverContext,
  UploadDriverHandlers,
  UploadSession,
} from 'uploadzx';

class MyDriver implements UploadDriver {
  readonly name = 'my-driver';
  readonly resumable = true; // if true, MUST emit a checkpoint in pause()

  createSession(ctx: UploadDriverContext, handlers: UploadDriverHandlers): UploadSession {
    return {
      async start() {
        // ctx.file, ctx.size, ctx.signal (AbortSignal), ctx.resume (prior checkpoint)
        handlers.onProgress(bytesUploaded);        // report progress
        handlers.onCheckpoint({ /* resume data */ }); // persist for resume
        handlers.onSuccess({ url });               // on completion
        // Report failure by THROWING / rejecting — there is no onError callback.
      },
      async pause() {
        handlers.onCheckpoint({ /* latest resume data */ });
        // stop the in-flight transfer
      },
    };
  }
}
```

> [!NOTE] **Contract:** a session signals failure by **rejecting** `start()` —
> there is intentionally no `onError` handler, which avoids double-dispatching the
> same error. Honor `ctx.signal` for cooperative cancellation. If `resumable` is
> `false`, the engine treats resume as a restart and resets progress to 0.

## The interfaces

```ts
interface UploadDriver<R extends ResumeData = ResumeData> {
  readonly name: string;
  readonly resumable: boolean;
  createSession(ctx: UploadDriverContext<R>, handlers: UploadDriverHandlers<R>): UploadSession;
}

interface UploadSession {
  start(): Promise<void>; // resolves on completion, rejects on error
  pause(): Promise<void>; // preserves the checkpoint; idempotent
}

interface UploadDriverHandlers<R> {
  onProgress(bytesUploaded: number): void;
  onCheckpoint(resume: R): void; // no-op for non-resumable drivers
  onSuccess(result: { url?: string; response?: unknown }): void;
}
```

You can also inject a custom _uploader factory_ at the queue level for advanced
cases (e.g. testing) via the `UploadQueue` directly.
