import { memo, useCallback } from 'react'
import { UploadDropzone } from 'uploadzx/react'

export const DropzoneSection = memo(() => {
  const handleFilesDrop = useCallback((files: any[]) => {
    console.log('Files dropped:', files)
  }, [])

  return (
    <UploadDropzone
      className="dropzone"
      activeClassName="dropzone-active"
      onFilesDrop={handleFilesDrop}
      clickable
    >
      <div style={{ fontSize: '18px', marginBottom: '10px' }}>
        📁 Drop files here to upload
      </div>
      <div style={{ fontSize: '14px', opacity: 0.7 }}>
        or click to select files
      </div>
    </UploadDropzone>
  )
})

DropzoneSection.displayName = 'DropzoneSection' 