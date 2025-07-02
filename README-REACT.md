# uploadzx/react

React hooks and components for the uploadzx library.

## Installation

```bash
npm install uploadzx
```

## Usage

### Basic Setup with Provider

```tsx
import { UploadzxProvider, useUploadzxContext } from 'uploadzx/react';

function App() {
  return (
    <UploadzxProvider
      options={{
        endpoint: 'https://your-upload-server.com/upload',
        chunkSize: 1024 * 1024, // 1MB chunks
        autoStart: true,
      }}
    >
      <UploadComponent />
    </UploadzxProvider>
  );
}

function UploadComponent() {
  const {
    pickAndUploadFiles,
    uploadStates,
    queueStats,
    pauseAll,
    resumeAll,
    cancelAll,
  } = useUploadzxContext();

  return (
    <div>
      <button onClick={pickAndUploadFiles}>Pick and Upload Files</button>
      <button onClick={pauseAll}>Pause All</button>
      <button onClick={resumeAll}>Resume All</button>
      <button onClick={cancelAll}>Cancel All</button>
      
      <div>Queue: {queueStats.queueLength}</div>
      <div>Active: {queueStats.activeCount}</div>
      
      {Object.entries(uploadStates).map(([fileId, state]) => (
        <div key={fileId}>
          {state.file.name} - {state.status} - {state.progress.percentage}%
        </div>
      ))}
    </div>
  );
}
```

### Using Hooks Directly

```tsx
import { useUploadzx, useUploadState, useUploadProgress } from 'uploadzx/react';

function UploadComponent() {
  const {
    pickAndUploadFiles,
    uploadStates,
    pauseUpload,
    resumeUpload,
    cancelUpload,
  } = useUploadzx({
    endpoint: 'https://your-upload-server.com/upload',
    chunkSize: 1024 * 1024,
    autoStart: true,
  });

  return (
    <div>
      <button onClick={pickAndUploadFiles}>Upload Files</button>
      
      {Object.keys(uploadStates).map(fileId => (
        <FileUploadItem key={fileId} fileId={fileId} />
      ))}
    </div>
  );
}

function FileUploadItem({ fileId }: { fileId: string }) {
  const state = useUploadState(uploadStates, fileId);
  const progress = useUploadProgress(uploadStates, fileId);
  
  if (!state) return null;

  return (
    <div>
      <div>{state.file.name}</div>
      <div>Status: {state.status}</div>
      {progress && <div>Progress: {progress.percentage}%</div>}
      
      {state.status === 'uploading' && (
        <button onClick={() => pauseUpload(fileId)}>Pause</button>
      )}
      {state.status === 'paused' && (
        <button onClick={() => resumeUpload(fileId)}>Resume</button>
      )}
      <button onClick={() => cancelUpload(fileId)}>Cancel</button>
    </div>
  );
}
```

### Drag and Drop Upload

```tsx
import { UploadDropzone } from 'uploadzx/react';

function DropzoneExample() {
  return (
    <UploadDropzone
      className="dropzone"
      activeClassName="dropzone-active"
      onFilesDrop={(files) => console.log('Files dropped:', files)}
    >
      <div>Drop files here to upload</div>
    </UploadDropzone>
  );
}
```

## API Reference

### Hooks

#### `useUploadzx(options)`

Main hook that provides upload functionality.

**Options:**
- `endpoint` (string): Upload server endpoint
- `chunkSize` (number): Chunk size in bytes
- `retryDelays` (number[]): Retry delay intervals
- `metadata` (Record<string, string>): Additional metadata
- `headers` (Record<string, string>): Custom headers
- `autoStart` (boolean): Auto-start uploads
- `onProgress` (function): Progress callback
- `onStateChange` (function): State change callback
- `onComplete` (function): Completion callback
- `onError` (function): Error callback
- `onCancel` (function): Cancel callback

**Returns:**
- `isInitialized` (boolean): Whether the uploader is initialized
- `uploadStates` (Record<string, UploadState>): Current upload states
- `queueStats` (object): Queue statistics
- `pickAndUploadFiles` (function): Pick and upload files
- `pickFiles` (function): Pick files only
- `addFiles` (function): Add files to queue
- `startUploads` (function): Start all uploads
- `pauseAll` (function): Pause all uploads
- `resumeAll` (function): Resume all uploads
- `cancelAll` (function): Cancel all uploads
- `pauseUpload` (function): Pause specific upload
- `resumeUpload` (function): Resume specific upload
- `cancelUpload` (function): Cancel specific upload
- `getUploadState` (function): Get upload state
- `getAllStates` (function): Get all upload states
- `restoreUnfinishedUploads` (function): Restore unfinished uploads

#### `useUploadState(uploadStates, fileId)`

Hook to track individual upload state.

#### `useUploadProgress(uploadStates, fileId)`

Hook to track upload progress for a specific file.

#### `useFilePicker(options)`

Hook for file picking functionality.

### Components

#### `UploadzxProvider`

Context provider for uploadzx functionality.

**Props:**
- `children` (ReactNode): Child components
- `options` (UseUploadzxOptions): Upload options

#### `UploadDropzone`

Drag and drop upload component.

**Props:**
- `children` (ReactNode): Content to display
- `onFilesDrop` (function): Callback when files are dropped
- `className` (string): CSS class name
- `activeClassName` (string): CSS class when drag is active
- `disabled` (boolean): Whether the dropzone is disabled

### Types

```typescript
interface UploadState {
  fileId: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: UploadProgress;
  error?: Error;
  tusUrl?: string;
  file: File;
}

interface UploadProgress {
  fileId: string;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
}
```

## Examples

See the `examples/` directory for complete working examples. 