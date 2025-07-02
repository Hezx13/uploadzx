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

## React Integration

uploadzx includes a React integration package with hooks and components:

```bash
import { useUploadzx, UploadzxProvider, UploadDropzone } from 'uploadzx/react';
```

### Basic React Usage

```tsx
import { UploadzxProvider, useUploadzxContext } from 'uploadzx/react';

function App() {
  return (
    <UploadzxProvider
      options={{
        endpoint: 'https://your-upload-server.com/upload',
        chunkSize: 1024 * 1024,
        autoStart: true,
      }}
    >
      <UploadComponent />
    </UploadzxProvider>
  );
}

function UploadComponent() {
  const { pickAndUploadFiles, uploadStates } = useUploadzxContext();
  
  return (
    <div>
      <button onClick={pickAndUploadFiles}>Upload Files</button>
      {Object.entries(uploadStates).map(([fileId, state]) => (
        <div key={fileId}>
          {state.file.name} - {state.status} - {state.progress.percentage}%
        </div>
      ))}
    </div>
  );
}
```

### Available Hooks

- `useUploadzx(options)` - Main upload hook
- `useUploadState(uploadStates, fileId)` - Track individual upload state
- `useUploadProgress(uploadStates, fileId)` - Track upload progress
- `useFilePicker(options)` - File picking functionality
- `useUploadzxContext()` - Access upload context

### Components

- `UploadzxProvider` - Context provider for upload functionality
- `UploadDropzone` - Drag and drop upload component

See [README-REACT.md](./README-REACT.md) for complete React documentation.

## Examples

The project includes example implementations in separate workspaces:

```bash
# Install all dependencies and build library
pnpm examples:install

# Run React + Vite example (localhost:3000)
pnpm example:react

# Run Vanilla JS + Vite example (localhost:3001)  
pnpm example:vanilla
```

### Available Examples

- **React + Vite** (`examples/react-vite/`) - Complete React integration with hooks and components
- **Vanilla + Vite** (`examples/vanilla-vite/`) - Pure TypeScript implementation using core library

Each example demonstrates file picking, drag & drop, progress tracking, and upload controls.

See [examples/README.md](./examples/README.md) for detailed documentation.

## Workspace Structure

This project uses pnpm workspaces to separate the main library from examples:

```
uploadzx/
├── src/                    # Main library source
├── dist/                   # Built library output  
├── examples/
│   ├── react-vite/         # React example workspace
│   ├── vanilla-vite/       # Vanilla JS example workspace
│   └── README.md           # Examples documentation
├── package.json            # Main library package
└── pnpm-workspace.yaml     # Workspace configuration
```

Benefits:
- ✅ **Isolated Dependencies**: Each example has its own dependencies
- ✅ **Local Library Reference**: Examples use `"uploadzx": "workspace:*"`
- ✅ **Independent Development**: Examples can be developed separately
- ✅ **Easy Testing**: Test library changes immediately in examples

## Next Steps

1. Add comprehensive error handling and retry logic
2. Add comprehensive tests
3. Add file validation utilities
4. Create Vue and Angular integrations
5. Optimize bundle size further 