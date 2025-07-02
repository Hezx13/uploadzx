# uploadzx React Vite Example

This example demonstrates how to use uploadzx with React and Vite.

## Setup

1. **Install dependencies** (from the root workspace):
   ```bash
   pnpm install
   ```

2. **Build the main library** (from the root):
   ```bash
   pnpm build
   ```

3. **Start the development server**:
   ```bash
   cd examples/react-vite
   pnpm dev
   ```

4. **Open your browser** to `http://localhost:3000`

## Features Demonstrated

- **File Picker**: Click to select files using the native file picker
- **Drag & Drop**: Drag files directly onto the dropzone
- **Upload Progress**: Real-time progress tracking with visual progress bars
- **Upload Controls**: Pause, resume, and cancel individual or all uploads
- **Queue Management**: See active uploads and queue statistics
- **Error Handling**: Display upload errors with helpful messages

## Code Structure

- `src/App.tsx` - Main application component with upload functionality
- `src/main.tsx` - React app entry point
- `src/index.css` - Styling for the upload interface
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration

## Key Components Used

```tsx
import { UploadzxProvider, useUploadzxContext, UploadDropzone } from 'uploadzx/react'

// Provider setup
<UploadzxProvider options={{ endpoint: '...' }}>
  <UploadComponent />
</UploadzxProvider>

// Using the context
const { pickAndUploadFiles, uploadStates, queueStats } = useUploadzxContext()

// Drag and drop
<UploadDropzone onFilesDrop={handleDrop}>
  Drop files here
</UploadDropzone>
```

## Upload Server

This example uses the demo tus server at `https://tusd.tusdemo.net/files/` for testing purposes. In production, you would replace this with your own tus-compatible server.

## Building for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory and can be served by any static file server. 