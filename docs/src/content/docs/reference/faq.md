---
title: FAQ
description: Answers to the questions developers actually hit.
---

## Do I need a special server?

For resumable uploads, yes — a
[tus-compatible server](https://tus.io/implementations) (e.g. `tusd`, or a tus
handler in your backend). For simple uploads, `HttpPutDriver` works with any
endpoint or a presigned URL, but without resume.

## The README shows `endpoint` at the top level — why doesn't it work?

The current API takes a `driver`. Use `driver: new TusDriver({ endpoint })`. The
driver indirection is what makes transports pluggable.

## Why did my completed upload disappear from `getAllStates()`?

Because `autoEvictCompleted` defaults to `true` to release the `File` from
memory. Listen to the `complete` event, or set the option to `false`. In React,
completed rows are retained by the store until you call `clearCompletedUploads()`.

## Why isn't my `progress` event firing on every byte?

Outward progress is coalesced (~100&nbsp;ms) to protect listeners and React from
flooding. The final 100% tick always fires. Internal state stays current
regardless.

## Resume isn't working — the file won't continue.

Check: (1) you're using a resumable driver (`TusDriver`, not `HttpPutDriver`);
(2) the file hasn't changed (`lastModified` + `size` must match); (3) the record
hasn't aged past `persistenceTtlMs`; (4) on Chrome/Edge, that you triggered
resume from a user gesture so read permission can be re-granted.

## How big can files be?

With tus there's no library-imposed cap — uploads are chunked. On the
Safari/Firefox fallback, very large files are cached as blobs and are bounded by
the origin's storage quota (guarded at ~95%).

## Does it log to my console?

No. The library is silent unless you pass `debug: true` or a custom `logger`.
Errors are still routed through the logger (not bare `console`) so you can capture
them.

## How do I clean up?

Call `destroy()` to detach listeners (the React provider does this automatically
on unmount). Note it does not cancel in-flight transfers — call `cancelAll()`
first if you need that.
