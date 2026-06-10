---
title: Recipes
description: Common React patterns — recovery after reload and showing completed history.
---

## Recovering unfinished uploads after a reload

When the user returns, uploads that were interrupted appear in
`useUnfinishedUploads()`. Offer a "Resume" button that calls
`restoreUnfinishedUpload`. With the File System Access API, the browser may
require a user gesture to re-grant read permission — which is exactly what a
button click is.

```tsx
function Recovery() {
  const { unfinishedUploads } = useUnfinishedUploads();
  const { restoreUnfinishedUpload } = useUploadzxActions();
  return (
    <>
      {unfinishedUploads.map((u) => (
        <div key={u.id}>
          {u.name}
          <button onClick={() => restoreUnfinishedUpload(u)}>Resume</button>
        </div>
      ))}
    </>
  );
}
```

## Showing completed history then clearing it

The React store retains completed rows (even though the core evicts its own
state) so you can show a "done" list. Call `clearCompletedUploads()` to remove
them and release the retained `File` objects.

```tsx
function CompletedBar() {
  const { clearCompletedUploads } = useUploadzxActions();
  return <button onClick={clearCompletedUploads}>Clear completed</button>;
}
```
