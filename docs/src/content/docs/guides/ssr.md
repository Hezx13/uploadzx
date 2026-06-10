---
title: SSR & environments
description: Safe construction on the server and what runs only in the browser.
---

uploadzx detects non-browser environments. Constructing on the server (Next.js,
Remix, etc.) won't touch IndexedDB — the queue simply initializes empty and
`ready` resolves immediately. Browser-only behavior (the picker, persistence,
actual transfers) only runs in the browser.

- Safe to import and instantiate during SSR; just gate file-picking / uploading
  behind a user action on the client.
- The React provider runs the same way — it constructs the core in an effect, so
  there's no IndexedDB access during server render.

> [!TIP] Helper utilities `isFileSystemAccessSupported()`, `isSafari()`, and
> `getBrowserInfo()` are exported if you need to branch in your own UI.
