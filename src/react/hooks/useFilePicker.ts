import { useCallback } from 'react';
import { FilePicker } from '../../core/FilePicker';
import type { FilePickerOptions, UploadFile } from '../../types';

export function useFilePicker(options: FilePickerOptions = {}) {
  const filePicker = new FilePicker(options);

  const pickFiles = useCallback(async (): Promise<UploadFile[]> => {
    return await filePicker.pickFiles();
  }, [filePicker]);

  return {
    pickFiles,
  };
} 