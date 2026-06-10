---
title: Introduction
description: What uploadzx is, who it's for, and the principles behind its design.
---

File uploads in the browser are deceptively hard once you go past a single
`<input type="file">`. You quickly need resumable transfers for large files and
flaky networks, a queue so you don't saturate the connection, progress tracking,
pause/resume/cancel, and a way to recover an interrupted upload after the user
closes the tab. **uploadzx** packages all of that behind a small, typed API built
on top of [tus-js-client](https://github.com/tus/tus-js-client).

It ships **no UI** — it emits state and exposes actions, and you build the
interface (or use the React bindings).

## Who is this for?

- **App developers** who want a robust upload experience (resumable, queued,
  recoverable) without wiring tus, IndexedDB, and the File System Access API by
  hand.
- **React developers** who want drop-in hooks that don't re-render the whole file
  list on every progress tick.
- **Contributors** who want to add a transport (S3, Azure, a presigned PUT) or a
  storage backend without touching the queue, progress, or React layers.

## Design principles

- **UI-agnostic.** The core renders nothing. It emits state and exposes actions.
- **Pluggable.** Transport and persistence are interfaces — swap tus for S3, or
  IndexedDB for an in-memory store.
- **Browser-first.** Targets modern browsers (ES2020+), with Safari and SSR-safe
  fallbacks built in.
- **Quiet by default.** No console noise; logging is opt-in via `debug` or a
  custom logger.

> [!NOTE] uploadzx is in active development (currently `v0.1.4`). The API is
> stabilizing but may still change between minor versions — pin a version and
> read the changelog before upgrading in production.

## Next steps

- [Installation](/docs/getting-started/installation) — add it to your project.
- [Quick start](/docs/getting-started/quick-start) — your first upload in a few
  lines.
- [Core concepts](/docs/getting-started/concepts) — the nouns and the lifecycle.
