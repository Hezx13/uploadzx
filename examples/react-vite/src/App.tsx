import { UploadzxProvider } from 'uploadzx/react'
import { UploadDashboard } from './components/dashboard/UploadDashboard'

const uploadOptions = {
  endpoint: 'https://tusd.tusdemo.net/files/',
  chunkSize: 1024 * 1024,
  autoStart: true,
  tusOptions: {
    trackSpeed: true,
  },
  filePickerOptions: {
    useFileSystemAccess: true,
  },
  maxConcurrent: 1,
  onProgress: (progress: number) => {
    console.log('Upload progress:', progress)
  },
  onComplete: (fileId: string, tusUrl: string) => {
    console.log('Upload completed:', fileId, tusUrl)
  },
  onError: (fileId: string, error: Error) => {
    console.error('Upload error:', fileId, error)
  },
}

function App() {
  return (
    <UploadzxProvider options={uploadOptions}>
      <UploadDashboard />
    </UploadzxProvider>
  )
}

export default App
