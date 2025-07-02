import { StoredFileHandle } from '../types';

export class FileHandleStore {
  private dbName = 'uploadzx-filehandles';
  private version = 1;
  private storeName = 'filehandles';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async storeFileHandle(fileHandle: FileSystemFileHandle, id: string): Promise<void> {
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

  async getFileHandle(id: string): Promise<StoredFileHandle | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllFileHandles(): Promise<StoredFileHandle[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removeFileHandle(id: string): Promise<void> {
    console.log('removeFileHandle', id);
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async verifyPermission(fileHandle: FileSystemFileHandle): Promise<boolean> {
    const permission = await (fileHandle as any).queryPermission({ mode: 'read' });
    console.log('permission', permission);
    if (permission === 'granted') {
      return true;
    }

    if (permission === 'prompt') {
      const requestPermission = await (fileHandle as any).requestPermission({ mode: 'read' });
      return requestPermission === 'granted';
    }

    return false;
  }
  
  async getFileFromHandleByID(id: string): Promise<File | null> {
    console.log('getFileFromHandleByID', id);
    const fileHandle = await this.getFileHandle(id);
    console.log('fileHandle', fileHandle);
    if (!fileHandle) {
      console.log("fileHandle not found", id);
      return null;
    }

    const hasPermission = await this.verifyPermission(fileHandle.handle);
    console.log('hasPermission', hasPermission);
    if (!hasPermission) {
      try {
        await (fileHandle.handle as any).requestPermission({ mode: 'read' });
      }
      catch {
        console.log('error requesting permission', fileHandle.id);
        await this.removeFileHandle(fileHandle.id);
        return null;
      }
    }
    try {
      const file = await fileHandle.handle.getFile();
      console.log('file', file);
      return file;
    }
    catch (error) {
      console.log('error getting file', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    console.log('clear');
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.clear();
  }
} 