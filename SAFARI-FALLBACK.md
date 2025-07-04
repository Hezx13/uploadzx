# Safari Fallback Implementation

This document explains how the Safari fallback works for the File System Access API in uploadzx.

## Problem

Safari doesn't support the File System Access API (`showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker`), which is used by uploadzx to provide persistent file handle storage and resumable upload capabilities.

## Solution

The FileHandleStore class now includes a Safari fallback that:

1. **Detects browser support** using `isFileSystemAccessSupported()`
2. **Stores actual file data** in IndexedDB instead of file handles
3. **Creates mock FileSystemFileHandle objects** that provide the same interface
4. **Maintains API compatibility** so the rest of the library works unchanged

## Implementation Details

### Browser Detection

```typescript
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 
         'showOpenFilePicker' in window && 
         'showSaveFilePicker' in window && 
         'showDirectoryPicker' in window;
}
```

### Dual Storage System

The FileHandleStore uses two IndexedDB object stores:

- **`filehandles`**: For browsers with File System Access API support (stores FileSystemFileHandle objects)
- **`safari-files`**: For Safari fallback (stores actual file data as ArrayBuffer)

### Safari Storage Structure

```typescript
interface SafariStoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  data: ArrayBuffer; // Actual file content
}
```

### Mock FileSystemFileHandle

For Safari, we create mock FileSystemFileHandle objects that:

```typescript
const mockHandle = {
  kind: 'file' as const,
  name: file.name,
  getFile: async () => file,
  queryPermission: async () => 'granted' as PermissionState,
  requestPermission: async () => 'granted' as PermissionState,
  createWritable: async () => {
    throw new Error('Write operations not supported in Safari fallback mode');
  },
  isSameEntry: async () => false,
} as FileSystemFileHandle;
```

## Key Features

### ✅ Supported in Safari Fallback
- File picking via `<input type="file">`
- File storage and retrieval
- Upload resumption (files are stored as data)
- Progress tracking
- File metadata preservation

### ❌ Not Supported in Safari Fallback
- Native file system access
- File writing/modification
- Directory picking
- Permission requests (always granted)

## Usage

The fallback is **completely transparent** to the application code. No changes needed:

```typescript
// This works the same in both Safari and Chrome
const filePicker = new FilePicker({ 
  useFileSystemAccess: true,
  multiple: true 
});

const files = await filePicker.pickFiles();
// Safari: Uses <input> + mock handles
// Chrome: Uses showOpenFilePicker()

const fileStore = new FileHandleStore();
await fileStore.storeFileHandle(files[0].fileHandle, files[0].id);
// Safari: Stores file data in IndexedDB
// Chrome: Stores file handle in IndexedDB
```

## Storage Considerations

### Safari Mode
- **Pros**: Files are always accessible, no permission issues
- **Cons**: Uses more storage space (stores full file data)
- **Limitation**: Large files may hit IndexedDB size limits

### Native Mode
- **Pros**: Minimal storage usage, true file system access
- **Cons**: Files may become inaccessible if moved/deleted, requires permissions

## Browser Support Matrix

| Browser | File System Access API | Fallback Mode | Upload Resumption |
|---------|----------------------|---------------|-------------------|
| Chrome 86+ | ✅ Native | ❌ | ✅ |
| Edge 86+ | ✅ Native | ❌ | ✅ |
| Safari | ❌ | ✅ IndexedDB | ✅ |
| Firefox | ❌ | ✅ IndexedDB | ✅ |

## Testing

Use the included `safari-fallback-test.html` to test the implementation:

1. Open the test file in different browsers
2. Test both native and fallback modes
3. Verify file storage and retrieval
4. Check upload resumption functionality

## Migration

The fallback is backward compatible. Existing data will continue to work, and the system will automatically use the appropriate storage method based on browser support.

## Performance Considerations

- **Safari**: File data is stored in memory during upload, may impact performance for large files
- **Chrome**: Only file handles are stored, minimal memory impact
- **IndexedDB**: Both modes use IndexedDB efficiently with proper indexing

## Security

- **Safari**: Files are copied to IndexedDB, isolated from file system
- **Chrome**: File handles maintain original file system permissions
- **Both**: All operations respect same-origin policy and secure contexts 