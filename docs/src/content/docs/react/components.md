---
title: Components
description: The UploadDropzone drag-and-drop surface.
---

## UploadDropzone

An unstyled drag-and-drop surface. It extracts files (and their File System
Access handles where supported, with a Safari fallback) and adds them to the
queue. Bring your own styles via `className` / `activeClassName`.

```tsx
import { UploadDropzone } from 'uploadzx/react';

<UploadDropzone
  className="dropzone"
  activeClassName="dropzone--over"
  clickable                       // click opens the picker too
  onFilesDrop={(files) => log(files)} // fires before they're queued
>
  Drag files here, or click to browse
</UploadDropzone>;
```

| Prop                              | Type                            | Description                                                  |
| --------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| `onFilesDrop`                     | `(files: UploadFile[]) => void` | Called with dropped files (also auto-added to the queue).    |
| `clickable`                       | `boolean`                       | Clicking the zone opens the file picker.                    |
| `disabled`                        | `boolean`                       | Ignore drops/clicks.                                        |
| `className` / `activeClassName`   | `string`                        | Base class; the active one is applied while dragging over.  |

Plus any standard `div` attributes. The component renders a single `<div>`
wrapping your children — no built-in visuals.
