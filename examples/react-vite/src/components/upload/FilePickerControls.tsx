import { memo } from 'react'
import { useQueueActions } from 'uploadzx/react'

export const FilePickerControls = memo(() => {
  const { 
    handlePickFiles, 
    handlePauseAll, 
    handleResumeAll, 
    handleCancelAll, 
    canPauseAll 
  } = useQueueActions()
  
  return (
    <div className="upload-controls">
      <button
        className="btn btn-primary"
        onClick={handlePickFiles}
      >
        📁 Pick and Upload Files
      </button>
      <button
        className="btn btn-warning"
        onClick={handlePauseAll}
        disabled={!canPauseAll}
      >
        ⏸️ Pause All
      </button>
      <button
        className="btn btn-success"
        onClick={handleResumeAll}
      >
        ▶️ Resume All
      </button>
      <button
        className="btn btn-danger"
        onClick={handleCancelAll}
      >
        ❌ Cancel All
      </button>
    </div>
  )
})

FilePickerControls.displayName = 'FilePickerControls' 