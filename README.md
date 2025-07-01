# Uploadzx

A browser-only TypeScript upload library that provides a developer-friendly abstraction over tus-js-client for resumable file uploads.

## Features

- File selection with both HTML input and File System Access API
- Resumable uploads using tus protocol
- Upload progress tracking
- Cancel, pause, and resume functionality
- Persistent upload state using IndexedDB
- Queue management for multiple uploads
- UI-agnostic design

## Project Structure

```
src/
├── types/
│   └── index.ts          # Core TypeScript interfaces
├── core/
│   ├── FilePicker.ts     # File selection with input and File System Access API
│   ├── TusUploader.ts    # Wrapper around tus-js-client
│   ├── UploadQueue.ts    # Multiple upload management
│   └── FileHandleStore.ts # IndexedDB persistence
├── utils/
│   └── index.ts          # Utility functions
└── index.ts              # Main entry point
```

## Basic Usage

```typescript
import Uploadzx from 'uploadzx';

const uploader = new Uploadzx({
  endpoint: 'https://your-tus-endpoint.com/files',
  maxConcurrent: 3,
  filePickerOptions: {
    multiple: true,
    useFileSystemAccess: true,
  }
}, {
  onProgress: (progress) => {
    console.log(`${progress.fileId}: ${progress.percentage}%`);
  },
  onComplete: (fileId, tusUrl) => {
    console.log(`Upload completed: ${tusUrl}`);
  },
  onError: (fileId, error) => {
    console.error(`Upload error for ${fileId}:`, error);
  }
});

// Pick files and start uploading
await uploader.pickAndUploadFiles();

// Or pick files separately
const files = await uploader.pickFiles();
await uploader.addFiles(files);
```

## Development Status

This is a minimal project structure. The actual tus-js-client integration is not yet implemented in the TusUploader class. The current implementation includes:

- ✅ Complete TypeScript type definitions
- ✅ File picker with File System Access API support
- ✅ IndexedDB file handle persistence
- ✅ Upload queue management
- ✅ Event system for progress tracking
- ⏳ Actual tus-js-client integration (pending)

## Testing

1. **Build the library**:
   ```bash
   pnpm build
   ```

2. **Start a local server**:
   ```bash
   pnpm serve
   ```

3. **Open the example**:
   Navigate to `http://localhost:8080/example.html`

4. **Test uploads**:
   - Uses the demo tus server at `https://tusd.tusdemo.net/files/`
   - Try uploading files to see resumable upload functionality
   - Test pause/resume/cancel operations

## Current Status

- ✅ Complete tus-js-client integration
- ✅ TypeScript type definitions  
- ✅ File picker with File System Access API support
- ✅ IndexedDB file handle persistence
- ✅ Upload queue management with concurrency control
- ✅ Event system for progress tracking
- ✅ Built and bundled with tsup (ESM, CJS, IIFE formats)
- ✅ Working browser example

## Next Steps

1. Add comprehensive error handling and retry logic
2. Create React integration module (optional)
3. Add comprehensive tests
4. Add file validation utilities
5. Optimize bundle size further 