import { useCallback, useState, ReactNode, DragEvent } from 'react';

import type { UploadFile } from '../../types';
import { useUploadzxContext } from './UploadzxProvider';

interface UploadDropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onFilesDrop?: (files: UploadFile[]) => void;
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
}

export function UploadDropzone({
  children,
  onFilesDrop,
  className = '',
  activeClassName = '',
  disabled = false,
}: UploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const { addFiles } = useUploadzxContext();

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const uploadFiles: UploadFile[] = files.map((file: File) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      onFilesDrop?.(uploadFiles);
      await addFiles(uploadFiles);
    }
  }, [disabled, onFilesDrop, addFiles]);

  const combinedClassName = `${className} ${isDragActive ? activeClassName : ''}`.trim();

  return (
    <div
      className={combinedClassName}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
} 