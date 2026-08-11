---
title: Integrity & checksums
description: Opt-in streaming BLAKE3 / SHA-256 hashing in a Web Worker, powering resume verification, checksum metadata, and dedup.
---

Uploadzx can hash each file before it uploads and reuse that digest three ways:
**content-addressed resume verification**, **a checksum sent to your server**, and
**dedup** (skipping files whose bytes were already uploaded this session). Hashing
runs in a Web Worker backed by a Rust → WebAssembly module, so multi-GB files are
hashed in constant memory without blocking the main thread.

The feature is fully opt-in. If you don't set `integrity`, none of the hashing
code or wasm is loaded — your bundle and runtime are untouched.

## Enabling it

```ts
import { Uploadzx, TusDriver } from 'uploadzx';

const uploader = new Uploadzx({
  driver: new TusDriver({ endpoint: '/files/' }),
  integrity: {
    algorithm: 'blake3', // or 'sha-256'
  },
});

uploader.on('hash', (fileId, digest) => {
  console.log(fileId, `${digest.algorithm}:${digest.hex}`);
});
```

With `integrity` set, every file is hashed once during a short **pre-upload
stage** (before the first byte is sent). The digest is then surfaced on
`state.integrity`, emitted via the `hash` event, and reused by the three behaviors
below.

## Options

All fields are optional; defaults are shown.

| Option         | Type                       | Default     | Description                                                                 |
| -------------- | -------------------------- | ----------- | --------------------------------------------------------------------------- |
| `algorithm`    | `'blake3' \| 'sha-256'`    | `'blake3'`  | Digest algorithm. BLAKE3 is fast and tree-hashed; SHA-256 for servers that require it. |
| `verifyResume` | `boolean`                  | `true`      | Re-hash a restored file and drop the record if the digest changed.          |
| `sendToServer` | `boolean`                  | `true`      | Attach the digest as upload metadata (tus) for end-to-end integrity.        |
| `metadataKey`  | `string`                   | `'checksum'`| Metadata key; value is `"<algorithm>:<hex>"`.                               |
| `dedup`        | `boolean`                  | `true`      | Skip a file whose digest matches one already completed this session.        |
| `chunkSize`    | `number`                   | `8388608`   | Slice size fed to the hasher (8 MiB).                                        |
| `workerFactory`| `() => Worker`             | —           | Provide the Worker yourself (bundler escape hatch — see below).             |
| `hasher`       | `IntegrityHasher`          | worker      | Inject a custom hasher (mainly for tests).                                   |

## The three behaviors

### 1. Content-addressed resume verification

The default resume check compares `lastModified` + `size`, which can miss
same-size edits made with the same timestamp. With `verifyResume`, a restored file
is re-hashed and compared against the persisted digest; on mismatch the stale
record is dropped instead of resuming into corrupt data. The digest is persisted
alongside resume progress, so verification is one extra read on resume — not on
every upload.

### 2. Checksum sent to the server

When `sendToServer` is on, the digest rides the tus upload-creation request as
metadata, e.g. `checksum: "blake3:<hex>"`. Your server can recompute and compare to
guarantee the stored bytes match what the browser hashed. Change the key with
`metadataKey` (e.g. `'sha256'`).

### 3. Dedup on start

If a file's digest matches one that already completed this session, the upload is
short-circuited to `completed` (emitting `complete` with the original's URL) without
transferring a single byte. Dedup is evaluated at upload **start**, reusing the
pre-upload hash — so files the user never uploads are never hashed.

> [!NOTE] The hashing pass adds latency before the first byte (one full read of the
> file). Resume verification and dedup reuse that same pass, so it's a single read,
> not several. For tiny files the cost is negligible; for very large files it's a
> deliberate trade for the guarantees above.

## Bundler wiring

The worker and its wasm ship as a separate ESM bundle under the
`uploadzx/integrity` subpath and are loaded lazily the first time a file is hashed.
The worker is created with the standard modern-bundler idiom:

```ts
new Worker(new URL('./worker/hash.worker.js', import.meta.url), { type: 'module' });
```

**Vite, Webpack 5, and Next** understand this pattern natively and will emit the
worker and `.wasm` as assets — no extra configuration. If your bundler can't
resolve it, supply the worker yourself:

```ts
integrity: {
  workerFactory: () =>
    new Worker(new URL('uploadzx/integrity/worker/hash.worker.js', import.meta.url), {
      type: 'module',
    }),
}
```

You can also bypass the worker entirely by injecting your own `hasher`
(implementing `IntegrityHasher`) — useful in tests or non-worker environments.

## Building from source

The wasm is produced from the `crates/uploadzx-hash` Rust crate. Contributors need
the Rust toolchain + `wasm-pack`; see [Contributing](/docs/reference/contributing).
The published package ships the prebuilt wasm, so consumers need no Rust toolchain.
