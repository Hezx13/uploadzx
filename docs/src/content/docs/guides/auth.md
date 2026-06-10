---
title: Dynamic auth
description: Refresh short-lived credentials per request for long-lived resumable uploads.
---

Resumable uploads can outlive a short-lived token — an upload paused for an hour
must resume with a _fresh_ credential, not the one captured at construction.
That's why `headers` and `metadata` accept a `DynamicValue`: a plain object _or_
a (possibly async) function that's re-resolved on every request.

```ts
new TusDriver({
  endpoint: '/files/',
  // Re-evaluated each time a (re)start/resume hits the network.
  headers: async () => ({ Authorization: `Bearer ${await auth.getFreshToken()}` }),
  metadata: () => ({ requestId: crypto.randomUUID() }),
});
```

The same `DynamicValue` support exists on `HttpPutDriver.headers`.

```ts
type DynamicValue<T> = T | (() => T | Promise<T>);
```
