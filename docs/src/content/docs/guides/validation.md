---
title: Validation
description: Enforce size, type, and count before files enter the queue.
---

Validation runs **before** a file enters the queue. Rejected files never get an
uploader; instead an `error` event is emitted for that file's id with a
descriptive message. `maxFiles` is checked per `addFiles()` batch and rejects the
whole batch if exceeded.

```ts
validation: {
  maxSize: 500 * 1024 * 1024,            // 500 MiB per file
  allowedTypes: ['image/*', 'application/pdf'], // wildcards supported
  maxFiles: 20,                          // per batch
}

uploader.on('error', (fileId, err) => {
  // e.g. "File size exceeds maximum of 500 MB" or "File type … is not allowed"
  toast(err.message);
});
```

| Field          | Type       | Effect                                                       |
| -------------- | ---------- | ----------------------------------------------------------- |
| `maxSize`      | `number`   | Reject files larger than this many bytes.                   |
| `allowedTypes` | `string[]` | Allow only matching MIME types; `image/*` wildcards work.   |
| `maxFiles`     | `number`   | Reject an `addFiles()` batch larger than this.              |
