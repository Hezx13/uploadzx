# uploadzx Vanilla JavaScript Example

This example demonstrates how to use uploadzx with vanilla JavaScript/TypeScript and Vite.

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
   cd examples/vanilla-vite
   pnpm dev
   ```

4. **Open your browser** to `http://localhost:3001`

## Features Demonstrated

- **File Picker**: Click to select files using the native file picker
- **Drag & Drop**: Drag files directly onto the dropzone
- **Upload Progress**: Real-time progress tracking with visual progress bars
- **Upload Controls**: Pause, resume, and cancel individual or all uploads
- **Queue Management**: See active uploads and queue statistics
- **Error Handling**: Display upload errors with helpful messages

## Code Structure

- `src/main.ts` - Main application logic using uploadzx core library
- `src/style.css` - Styling for the upload interface
- `index.html` - HTML structure
- `vite.config.ts` - Vite configuration

## Key APIs Used

```typescript
import Uploadzx from 'uploadzx'

// Initialize uploader
const uploader = new Uploadzx({
  endpoint: 'https://tusd.tusdemo.net/files/',
  chunkSize: 1024 * 1024,
  maxConcurrent: 3,
  autoStart: true,
}, {
  onProgress: (progress) => { /* handle progress */ },
  onStateChange: (state) => { /* handle state changes */ },
  onComplete: (fileId, tusUrl) => { /* handle completion */ },
  onError: (fileId, error) => { /* handle errors */ },
})

// Upload methods
await uploader.pickAndUploadFiles()
await uploader.addFiles(files)
await uploader.pauseAll()
await uploader.resumeAll()
await uploader.cancelAll()
```

## Upload Server

This example uses the demo tus server at `https://tusd.tusdemo.net/files/` for testing purposes. In production, you would replace this with your own tus-compatible server.

## Building for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory and can be served by any static file server. 