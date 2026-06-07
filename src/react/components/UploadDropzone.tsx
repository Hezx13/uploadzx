import { useCallback, useState, ReactNode, DragEvent } from 'react';

import type { UploadFile } from '../../types';
import { useUploadzxActions } from './UploadzxProvider';
import { getFilesFromDragEvent, generateFileId } from '../../utils';

interface UploadDropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onFilesDrop?: (files: UploadFile[]) => void;

  className?: string;
  activeClassName?: string;
  disabled?: boolean;
  clickable?: boolean;
}

export function UploadDropzone({
  children,
  onFilesDrop,
  className = '',
  activeClassName = '',
  disabled = false,
  clickable = false,
}: UploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const { addFiles, pickAndUploadFiles } = useUploadzxActions();

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      try {
        // Extract files and their handles from the drag event
        const fileHandlePairs = await getFilesFromDragEvent(e);

        if (fileHandlePairs.length > 0) {
          const uploadFiles: UploadFile[] = fileHandlePairs.map(({ file, handle }) => ({
            id: generateFileId(),
            file,
            fileHandle: handle,
            name: file.name,
            size: file.size,
            type: file.type,
          }));

          onFilesDrop?.(uploadFiles);
          await addFiles(uploadFiles);
        }
      } catch {
        // Fallback to the old method if handle extraction fails
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          const uploadFiles: UploadFile[] = files.map((file: File) => ({
            id: generateFileId(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
          }));

          onFilesDrop?.(uploadFiles);
          await addFiles(uploadFiles);
        }
      }
    },
    [disabled, onFilesDrop, addFiles]
  );

  const handleClick = useCallback(() => {
    pickAndUploadFiles();
  }, [pickAndUploadFiles]);

  const combinedClassName = `${className} ${isDragActive ? activeClassName : ''}`.trim();

  return (
    <div
      className={combinedClassName}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={clickable ? handleClick : undefined}
    >
      {children}
    </div>
  );
}
