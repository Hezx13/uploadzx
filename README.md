# uploadzx

> ⚠️ **Development Notice**: This library is currently in active development. The stable release is planned for **July 14, 2025**. Use with caution in production environments.

[![npm version](https://img.shields.io/npm/v/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![npm downloads](https://img.shields.io/npm/dm/uploadzx.svg)](https://www.npmjs.com/package/uploadzx)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser-only TypeScript upload library that provides a developer-friendly abstraction over tus-js-client for resumable file uploads with React integration.

## Features

- 🚀 **Resumable uploads** using tus protocol
- 📱 **Cross-browser compatibility** including Safari fallback
- ⚡ **File System Access API** support for modern browsers
- 🎯 **React integration** with hooks and components
- 📊 **Progress tracking** with detailed upload statistics
- ⏸️ **Pause, resume, and cancel** functionality
- 💾 **Persistent upload state** using IndexedDB
- 🔄 **Queue management** for multiple uploads
- 🎨 **UI-agnostic design** - bring your own UI or use our React components

## Installation

```bash
npm install uploadzx
# or
pnpm add uploadzx
# or
yarn add uploadzx
```

## Quick Start

### Vanilla JavaScript/TypeScript

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
```

### React Integration

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
          {state.file.name} - {state.status} - {state.progress?.percentage}%
        </div>
      ))}
    </div>
  );
}
```

## React Hooks

- `useUploadzxContext()` - Access upload context and state
- `useUploadItem(fileId, state)` - Manage individual upload items
- `useQueueActions()` - Queue management actions
- `useFilePicker(options)` - File picking functionality

## React Components

- `UploadzxProvider` - Context provider for upload functionality
- `UploadDropzone` - Drag and drop upload component

## API Reference

### Core Options

```typescript
interface UploadzxOptions {
  endpoint: string;
  chunkSize?: number;
  maxConcurrent?: number;
  autoStart?: boolean;
  filePickerOptions?: {
    multiple?: boolean;
    useFileSystemAccess?: boolean;
    accept?: string;
  };
}
```

### Event Handlers

```typescript
interface UploadzxEvents {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (fileId: string, tusUrl: string) => void;
  onError?: (fileId: string, error: Error) => void;
  onStateChange?: (fileId: string, state: UploadState) => void;
}
```

## Browser Support

- **Chrome/Edge**: Full support with File System Access API
- **Firefox**: Full support with fallback file picker
- **Safari**: Full support with Safari-specific optimizations
- **Mobile browsers**: Supported with appropriate fallbacks

## Examples

The project includes comprehensive examples:

```bash
# Install all dependencies and build library
pnpm examples:install

# Run React + Vite example
pnpm example:react

# Run Vanilla JS + Vite example
pnpm example:vanilla
```

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm build

# Watch for changes
pnpm dev

# Run examples
pnpm example:react
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [uploadzx](https://github.com/Hezx13/uploadzx) 