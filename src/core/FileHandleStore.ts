import { StoredFileHandle } from '../types';
import { isFileSystemAccessSupported } from '../utils';

interface SafariStoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  data: ArrayBuffer; // Store actual file data for Safari
  tusUploadUrl?: string; // Store upload URL for resumption
  bytesUploaded?: number; // Store upload progress
}

export class FileHandleStore {
  private dbName = 'uploadzx-filehandles';
  private version = 2; // increment this for safari fallback support
  private storeName = 'filehandles';
  private safariStoreName = 'safari-files';
  private isFileSystemAccessSupported = isFileSystemAccessSupported();

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = () => {
        const db = request.result;

        // Original store for File System Access API
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        }

        // Safari fallback store for actual file data
        if (!db.objectStoreNames.contains(this.safariStoreName)) {
          const safariStore = db.createObjectStore(this.safariStoreName, { keyPath: 'id' });
          safariStore.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async storeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
    if (this.isFileSystemAccessSupported) {
      return this.storeNativeFileHandle(fileHandle, id);
    } else {
      // For Safari, we need to store the actual file data
      const file = await fileHandle.getFile();
      return this.storeSafariFile(file, id);
    }
  }

  private async storeNativeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
    const db = await this.openDB();
    const file = await fileHandle.getFile();

    const storedHandle: StoredFileHandle = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      handle: fileHandle,
      lastModified: file.lastModified,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(storedHandle);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async storeSafariFile(file: File, id: string): Promise<void> {
    const db = await this.openDB();
    const data = await file.arrayBuffer();

    const safariFile: SafariStoredFile = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      data,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.safariStoreName], 'readwrite');
      const store = transaction.objectStore(this.safariStoreName);
      const request = store.put(safariFile);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getFileHandle(id: string): Promise<StoredFileHandle | null> {
    if (this.isFileSystemAccessSupported) {
      return this.getNativeFileHandle(id);
    } else {
      return this.getSafariFileAsHandle(id);
    }
  }

  private async getNativeFileHandle(id: string): Promise<StoredFileHandle | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  private async getSafariFileAsHandle(id: string): Promise<StoredFileHandle | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.safariStoreName], 'readonly');
      const store = transaction.objectStore(this.safariStoreName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const safariFile = request.result as SafariStoredFile;
        if (!safariFile) {
          resolve(null);
          return;
        }

        // Create a mock FileSystemFileHandle for Safari
        const mockHandle = this.createMockFileHandle(safariFile);
        const storedHandle: StoredFileHandle = {
          id: safariFile.id,
          name: safariFile.name,
          size: safariFile.size,
          type: safariFile.type,
          handle: mockHandle,
          lastModified: safariFile.lastModified,
          tusUploadUrl: safariFile.tusUploadUrl,
          bytesUploaded: safariFile.bytesUploaded,
        };
        resolve(storedHandle);
      };
    });
  }

  private createMockFileHandle(safariFile: SafariStoredFile): FileSystemFileHandle {
    const file = new File([safariFile.data], safariFile.name, {
      type: safariFile.type,
      lastModified: safariFile.lastModified,
    });

    const mockHandle = {
      kind: 'file' as const,
      name: safariFile.name,
      getFile: async () => file,
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      createWritable: async () => {
        throw new Error('Write operations not supported in Safari fallback mode');
      },
      isSameEntry: async () => false,
    } as FileSystemFileHandle;

    return mockHandle;
  }

  async getAllFileHandles(): Promise<StoredFileHandle[]> {
    if (this.isFileSystemAccessSupported) {
      return this.getAllNativeFileHandles();
    } else {
      return this.getAllSafariFilesAsHandles();
    }
  }

  private async getAllNativeFileHandles(): Promise<StoredFileHandle[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async getAllSafariFilesAsHandles(): Promise<StoredFileHandle[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.safariStoreName], 'readonly');
      const store = transaction.objectStore(this.safariStoreName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const safariFiles = request.result as SafariStoredFile[];
        const handles = safariFiles.map(safariFile => {
          const mockHandle = this.createMockFileHandle(safariFile);
          return {
            id: safariFile.id,
            name: safariFile.name,
            size: safariFile.size,
            type: safariFile.type,
            handle: mockHandle,
            lastModified: safariFile.lastModified,
            tusUploadUrl: safariFile.tusUploadUrl,
            bytesUploaded: safariFile.bytesUploaded,
          } as StoredFileHandle;
        });
        resolve(handles);
      };
    });
  }

  async removeFileHandle(id: string): Promise<void> {
    console.log('removeFileHandle', id);
    const db = await this.openDB();

    const storeName = this.isFileSystemAccessSupported ? this.storeName : this.safariStoreName;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async updateFileHandleProgress(
    id: string,
    tusUploadUrl: string,
    bytesUploaded: number
  ): Promise<void> {
    if (this.isFileSystemAccessSupported) {
      return this.updateNativeFileHandleProgress(id, tusUploadUrl, bytesUploaded);
    } else {
      return this.updateSafariFileHandleProgress(id, tusUploadUrl, bytesUploaded);
    }
  }

  private async updateNativeFileHandleProgress(
    id: string,
    tusUploadUrl: string,
    bytesUploaded: number
  ): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const storedHandle = getRequest.result as StoredFileHandle;
        if (storedHandle) {
          storedHandle.tusUploadUrl = tusUploadUrl;
          storedHandle.bytesUploaded = bytesUploaded;

          const putRequest = store.put(storedHandle);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve(); // Handle not found, nothing to update
        }
      };
    });
  }

  private async updateSafariFileHandleProgress(
    id: string,
    tusUploadUrl: string,
    bytesUploaded: number
  ): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.safariStoreName], 'readwrite');
      const store = transaction.objectStore(this.safariStoreName);
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const safariFile = getRequest.result as SafariStoredFile;
        if (safariFile) {
          safariFile.tusUploadUrl = tusUploadUrl;
          safariFile.bytesUploaded = bytesUploaded;

          const putRequest = store.put(safariFile);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve(); // File not found, nothing to update
        }
      };
    });
  }

  async verifyPermission(fileHandle: FileSystemFileHandle): Promise<boolean> {
    // Safari fallback handles always have permission since we store the data directly
    if (!this.isFileSystemAccessSupported) {
      return true;
    }

    try {
      const permission = await (fileHandle as any).queryPermission({ mode: 'read' });
      if (permission === 'granted') {
        return true;
      }

      if (permission === 'prompt') {
        const requestPermission = await (fileHandle as any).requestPermission({ mode: 'read' });
        return requestPermission === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Error verifying permission:', error);
      return false;
    }
  }

  async getFileFromHandleByID(id: string): Promise<File | null> {
    console.log('getFileFromHandleByID', id);
    if (!this.isFileSystemAccessSupported) {
      // Safari fallback: get file directly from stored data
      return this.getSafariFileByID(id);
    }

    const fileHandle = await this.getFileHandle(id);
    if (!fileHandle) {
      return null;
    }

    const hasPermission = await this.verifyPermission(fileHandle.handle);
    if (!hasPermission) {
      try {
        console.log('requesting permission', fileHandle.id);
        await (fileHandle.handle as any).requestPermission({ mode: 'read' });
      } catch {
        console.log('error requesting permission', fileHandle.id);
        await this.removeFileHandle(fileHandle.id);
        return null;
      }
    }
    try {
      const file = await fileHandle.handle.getFile();
      return file;
    } catch (error) {
      return null;
    }
  }

  private async getSafariFileByID(id: string): Promise<File | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.safariStoreName], 'readonly');
      const store = transaction.objectStore(this.safariStoreName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const safariFile = request.result as SafariStoredFile;
        if (!safariFile) {
          resolve(null);
          return;
        }

        const file = new File([safariFile.data], safariFile.name, {
          type: safariFile.type,
          lastModified: safariFile.lastModified,
        });
        resolve(file);
      };
    });
  }

  async clear(): Promise<void> {
    console.log('clear');
    const db = await this.openDB();

    const storeNames = this.isFileSystemAccessSupported
      ? [this.storeName]
      : [this.storeName, this.safariStoreName]; // Clear both stores to be safe

    const transaction = db.transaction(storeNames, 'readwrite');

    storeNames.forEach(storeName => {
      if (db.objectStoreNames.contains(storeName)) {
        const store = transaction.objectStore(storeName);
        store.clear();
      }
    });
  }
}
