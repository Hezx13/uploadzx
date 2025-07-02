import { useState } from 'react'
import { UploadzxProvider, useUploadzxContext, UploadDropzone } from 'uploadzx/react'
import type { UploadState } from 'uploadzx/react'

function App() {
  return (
    <UploadzxProvider
      options={{
        endpoint: 'https://tusd.tusdemo.net/files/',
        chunkSize: 1024 * 1024, // 1MB chunks
        autoStart: true,
        filePickerOptions: {
          useFileSystemAccess: true,
        },
        maxConcurrent: 3,
        onProgress: (progress) => {
          console.log('Upload progress:', progress)
        },
        onComplete: (fileId, tusUrl) => {
          console.log('Upload completed:', fileId, tusUrl)
        },
        onError: (fileId, error) => {
          console.error('Upload error:', fileId, error)
        },
      }}
    >
      <div className="upload-container">
        <h1>uploadzx React Example</h1>
        <p>Upload files using the demo tus server</p>
        <UploadDemo />
      </div>
    </UploadzxProvider>
  )
}

function UploadDemo() {
  const [activeTab, setActiveTab] = useState<'picker' | 'dropzone' | 'unfinished'>('picker')
  const {
    pickAndUploadFiles,
    restoreUnfinishedUpload,
    unfinishedUploads,
    uploadStates,
    queueStats,
    pauseAll,
    resumeAll,
    cancelAll,
    isInitialized,
  } = useUploadzxContext()

  const uploadStatesArray = Object.entries(uploadStates)

  if (!isInitialized) {
    return <div>Initializing uploader...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }} className="upload-controls">
        <button
          className={`btn ${activeTab === 'picker' ? 'btn-primary' : 'btn'}`}
          onClick={() => setActiveTab('picker')}
        >
          File Picker
        </button>
        <button
          className={`btn ${activeTab === 'dropzone' ? 'btn-primary' : 'btn'}`}
          onClick={() => setActiveTab('dropzone')}
        >
          Drag & Drop
        </button>
        <button
          className={`btn ${activeTab === 'unfinished' ? 'btn-primary' : 'btn'}`}
          onClick={() => setActiveTab('unfinished')}
        >
          Unfinished Uploads
        </button>
      </div>

      {activeTab === 'unfinished' && (
        <div>
          <h3>Unfinished Uploads:</h3>
          {unfinishedUploads.map((upload) => (
            <div key={upload.id}>
              <div>{upload.name}</div>
              <button onClick={() => restoreUnfinishedUpload(upload.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'picker' && (
        <div className="upload-controls">
          <button
            className="btn btn-primary"
            onClick={pickAndUploadFiles}
          >
            📁 Pick and Upload Files
          </button>
          <button
            className="btn btn-warning"
            onClick={pauseAll}
            disabled={queueStats.activeCount === 0}
          >
            ⏸️ Pause All
          </button>
          <button
            className="btn btn-success"
            onClick={resumeAll}
          >
            ▶️ Resume All
          </button>
          <button
            className="btn btn-danger"
            onClick={cancelAll}
          >
            ❌ Cancel All
          </button>
        </div>
      )}

      {activeTab === 'dropzone' && (
        <UploadDropzone
          className="dropzone"
          activeClassName="dropzone-active"
          onFilesDrop={(files) => {
            console.log('Files dropped:', files)
          }}
        >
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            📁 Drop files here to upload
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            or click to select files
          </div>
        </UploadDropzone>
      )}

      <div className="stats">
        <strong>Queue Stats:</strong> {queueStats.queueLength} in queue, {queueStats.activeCount} active
      </div>

      {uploadStatesArray.length > 0 && (
        <div>
          <h3>Uploads:</h3>
          {uploadStatesArray.map(([fileId, state]) => (
            <UploadItem key={fileId} fileId={fileId} state={state} />
          ))}
        </div>
      )}
    </div>
  )
}

function UploadItem({ fileId, state }: { fileId: string; state: UploadState }) {
  const { pauseUpload, resumeUpload, cancelUpload } = useUploadzxContext()
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4ade80'
      case 'error': return '#ef4444'
      case 'uploading': return '#646cff'
      case 'paused': return '#facc15'
      case 'cancelled': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // const formatSpeed = (bytesPerSecond: number) => {
  //   if (bytesPerSecond === 0) return '0 B/s'
  //   const k = 1024
  //   const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  //   const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  //   return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  // }

  return (
    <div className="upload-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {state.file.name}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            {formatFileSize(state.file.size)}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              color: getStatusColor(state.status),
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '12px',
              marginBottom: '5px',
            }}
          >
            {state.status}
          </div>
          {state.progress && (
            <div style={{ fontSize: '14px' }}>
              {state.progress.percentage.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      
      {state.progress && (
        <div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${state.progress.percentage}%`,
                backgroundColor: getStatusColor(state.status),
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
            <span>{formatFileSize(state.progress.bytesUploaded)} / {formatFileSize(state.progress.bytesTotal)}</span>
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
        {state.status === 'uploading' && (
          <button
            className="btn btn-warning"
            onClick={() => pauseUpload(fileId)}
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            ⏸️ Pause
          </button>
        )}
        
        {state.status === 'paused' && (
          <button
            className="btn btn-success"
            onClick={() => resumeUpload(fileId)}
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            ▶️ Resume
          </button>
        )}
        
        {state.status !== 'completed' && state.status !== 'cancelled' && (
          <button
            className="btn btn-danger"
            onClick={() => cancelUpload(fileId)}
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            ❌ Cancel
          </button>
        )}
      </div>
      
      {state.error && (
        <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '14px', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
          <strong>Error:</strong> {state.error.message}
        </div>
      )}
    </div>
  )
}

export default App 