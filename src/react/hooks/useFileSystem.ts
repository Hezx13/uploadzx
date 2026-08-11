import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FileSystemManager } from '../../fs/FileSystemManager';
import type { FsEntry, FsManagerOptions } from '../../fs/types';

export function useFileSystemManager(options: FsManagerOptions = {}) {
  const managerRef = useRef<FileSystemManager>();
  if (!managerRef.current) {
    managerRef.current = new FileSystemManager(options);
  }
  const manager = managerRef.current;

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  const pickFiles = useCallback(
    (withinGesture = true) => manager.pickFiles(withinGesture),
    [manager]
  );

  const pickDirectory = useCallback(
    (withinGesture = true) => manager.pickDirectory(withinGesture),
    [manager]
  );

  const reconnect = useCallback(
    (withinGesture = true) => manager.reconnect(withinGesture),
    [manager]
  );

  return {
    manager,
    ready: manager.ready,
    pickFiles,
    pickDirectory,
    reconnect,
    list: manager.list.bind(manager),
    readFile: manager.readFile.bind(manager),
    readMetadata: manager.readMetadata.bind(manager),
    getThumbnail: manager.getThumbnail.bind(manager),
    saveAs: manager.saveAs.bind(manager),
    remove: manager.remove.bind(manager),
  };
}

export function useFsPermissions(manager: FileSystemManager) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.on('permissionchange', onStoreChange);
    },
    [manager]
  );

  const getSnapshot = useCallback(() => manager.pendingPermissions(), [manager]);

  const pending = useSyncExternalStore(subscribe, getSnapshot, () => []);

  const reconnect = useCallback(
    (withinGesture = true) => manager.reconnect(withinGesture),
    [manager]
  );

  return { pending, reconnect, hasPending: pending.length > 0 };
}

export function useFsEntries(manager: FileSystemManager, parentId?: string) {
  const [entries, setEntries] = useState<FsEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    void manager.list(parentId).then(list => {
      if (mounted) setEntries(list);
    });

    const offAdd = manager.on('add', () => {
      void manager.list(parentId).then(list => {
        if (mounted) setEntries(list);
      });
    });
    const offRemove = manager.on('remove', () => {
      void manager.list(parentId).then(list => {
        if (mounted) setEntries(list);
      });
    });

    return () => {
      mounted = false;
      offAdd();
      offRemove();
    };
  }, [manager, parentId]);

  return entries;
}
