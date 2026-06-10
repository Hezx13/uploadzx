---
title: Transport drivers
description: The built-in tus and HTTP PUT drivers, their options, and when to use each.
---

A driver is where bytes actually go. The queue, persistence, progress, and React
layers are transport-agnostic, so you can change _how_ files upload without
touching anything else. Two drivers ship in the box.

## TusDriver — resumable (recommended)

Resumable uploads over the [tus protocol](https://tus.io/). This is the driver
that unlocks pause/resume across reloads.

```ts
import { TusDriver, tus } from 'uploadzx';

const driver = new TusDriver({
  endpoint: 'https://your-tus-server.com/files/',
  chunkSize: 1024 * 1024,            // default 1 MiB
  retryDelays: [0, 3000, 5000, 10000], // tus retry backoff
  headers: async () => ({ Authorization: `Bearer ${await token()}` }),
  metadata: { folder: 'avatars' },   // merged with filename/filetype
});

// `tus(options)` is a factory shorthand for `new TusDriver(options)`.
const same = tus({ endpoint: '/files/' });
```

| Option        | Type                                  | Default                       | Notes                                       |
| ------------- | ------------------------------------- | ----------------------------- | ------------------------------------------- |
| `endpoint`    | `string`                              | —                             | **Required.** tus creation endpoint.        |
| `chunkSize`   | `number`                              | `1048576`                     | Bytes per PATCH request.                    |
| `retryDelays` | `number[]`                            | `[0,3000,5000,10000,20000]`   | Backoff between retries.                     |
| `headers`     | `DynamicValue<Record<string,string>>` | —                            | Static or (async) factory; resolved per request. |
| `metadata`    | `DynamicValue<Record<string,string>>` | —                            | Merged with auto `filename`/`filetype`.     |

## HttpPutDriver — simple, non-resumable

A single `PUT` or `POST` to one URL. Good for presigned S3/GCS URLs and small
files. It is **not resumable**: a "resume" restarts from byte&nbsp;0.

```ts
import { HttpPutDriver, httpPut } from 'uploadzx';

// Raw PUT to a presigned URL.
const s3 = new HttpPutDriver({ url: presignedUrl, method: 'PUT' });

// Multipart POST to your own endpoint (set fieldName to use FormData).
const form = httpPut({
  url: '/api/upload',
  method: 'POST',
  fieldName: 'file',
  headers: { 'X-CSRF': csrf },
  timeoutMs: 30000,
});
```

| Option      | Type                | Default | Notes                                                                 |
| ----------- | ------------------- | ------- | --------------------------------------------------------------------- |
| `url`       | `string`            | —       | **Required.** Destination URL.                                        |
| `method`    | `'PUT' \| 'POST'`   | `'PUT'` | HTTP verb.                                                            |
| `headers`   | `DynamicValue<…>`   | —       | Resolved per request.                                                 |
| `fieldName` | `string`            | —       | If set, sends multipart FormData under this field; otherwise raw body.|
| `timeoutMs` | `number`            | `0`     | Request timeout (0 = none).                                           |

> [!TIP] Use `TusDriver` when you control (or can deploy) a tus server and want
> resumability for large files. Use `HttpPutDriver` for presigned URLs or simple
> backends where restart-on-failure is acceptable.
