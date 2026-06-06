import { UploadProgress, UploadzxProvider } from 'uploadzx/react'
import { UploadDashboard } from './components/dashboard/UploadDashboard'
import { TusDriver } from 'uploadzx';

const uploadOptions = {
  driver: new TusDriver({
    endpoint: 'https://tusd.tusdemo.net/files/',
  }),
  chunkSize: 1024 * 1024,
  autoStart: true,
  filePickerOptions: {
    useFileSystemAccess: true,
  },
  maxConcurrent: 1,
  onProgress: (progress: UploadProgress) => {
    console.log('Upload progress:', progress)
  },
  onComplete: (fileId: string, url: string) => {
    console.log('Upload completed:', fileId, url)
  },
  onError: (fileId: string) => {
    console.error('Upload error:', fileId)
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
