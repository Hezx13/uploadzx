import { useCallback, useRef } from 'react';
import { FilePicker } from '../../core/FilePicker';
import type { FilePickerOptions, UploadFile } from '../../types';

export function useFilePicker(options: FilePickerOptions = {}) {
  // Build the picker once; rebuilding it every render made the memoized
  // callback below change identity on each render (i.e. did nothing).
  const pickerRef = useRef<FilePicker>();
  if (!pickerRef.current) {
    pickerRef.current = new FilePicker(options);
  }

  const pickFiles = useCallback(async (): Promise<UploadFile[]> => {
    return pickerRef.current!.pickFiles();
  }, []);

  return { pickFiles };
}
