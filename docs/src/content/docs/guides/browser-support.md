---
title: Browser support
description: Where uploadzx runs and how it adapts per browser.
---

| Browser         | Status    | Notes                                                                          |
| --------------- | --------- | ----------------------------------------------------------------------------- |
| Chrome / Edge   | Full      | File System Access API: handles persisted as references; resume re-reads from disk. |
| Firefox         | Full      | Fallback picker; files cached as blobs in IndexedDB for resume.                |
| Safari          | Full      | Safari-specific fallback (split metadata/blob stores, quota-guarded).          |
| Mobile browsers | Supported | With the same fallbacks; storage quotas are tighter.                           |

Helper utilities `isFileSystemAccessSupported()`, `isSafari()`, and
`getBrowserInfo()` are exported if you need to branch in your own UI.
