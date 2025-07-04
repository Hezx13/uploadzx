import { UploadzxProvider } from 'uploadzx/react'
import { UploadDemo } from './components/UploadDemo'

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
        <header style={{ 
          textAlign: 'center', 
          marginBottom: '40px',
          padding: '20px 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #646cff 0%, #747bff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            uploadzx React Example
          </h1>
          <p style={{ 
            fontSize: '16px', 
            opacity: 0.7,
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Upload files using the demo tus server with resumable uploads, 
            cross-browser compatibility, and a beautiful Google Drive-style interface
          </p>
        </header>
        
        <UploadDemo />
      </div>
    </UploadzxProvider>
  )
}

export default App 