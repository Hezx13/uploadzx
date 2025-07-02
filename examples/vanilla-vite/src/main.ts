import Uploadzx from 'uploadzx'
import type { UploadState } from 'uploadzx'
import './style.css'

// Initialize uploadzx
const uploader = new Uploadzx({
  endpoint: 'https://tusd.tusdemo.net/files/',
  chunkSize: 1024 * 1024, // 1MB chunks
  maxConcurrent: 3,
  autoStart: true,
}, {
  onProgress: (progress) => {
    console.log('Upload progress:', progress)
    updateUploadProgress(progress.fileId, progress)
  },
  onStateChange: (state) => {
    console.log('State change:', state)
    updateUploadState(state)
    updateStats()
  },
  onComplete: (fileId, tusUrl) => {
    console.log('Upload completed:', fileId, tusUrl)
  },
  onError: (fileId, error) => {
    console.error('Upload error:', fileId, error)
  },
  onCancel: (fileId) => {
    console.log('Upload cancelled:', fileId)
  },
})

// DOM elements
const pickFilesBtn = document.getElementById('pick-files') as HTMLButtonElement
const pauseAllBtn = document.getElementById('pause-all') as HTMLButtonElement
const resumeAllBtn = document.getElementById('resume-all') as HTMLButtonElement
const cancelAllBtn = document.getElementById('cancel-all') as HTMLButtonElement
const dropzone = document.getElementById('dropzone') as HTMLDivElement
const statsElement = document.getElementById('queue-stats') as HTMLSpanElement
const uploadsContainer = document.getElementById('uploads') as HTMLDivElement

// Event listeners
pickFilesBtn.addEventListener('click', async () => {
  await uploader.pickAndUploadFiles()
})

pauseAllBtn.addEventListener('click', async () => {
  await uploader.pauseAll()
})

resumeAllBtn.addEventListener('click', async () => {
  await uploader.resumeAll()
})

cancelAllBtn.addEventListener('click', async () => {
  await uploader.cancelAll()
})

// Drag and drop
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault()
  dropzone.classList.add('dropzone-active')
})

dropzone.addEventListener('dragleave', (e) => {
  e.preventDefault()
  dropzone.classList.remove('dropzone-active')
})

dropzone.addEventListener('drop', async (e) => {
  e.preventDefault()
  dropzone.classList.remove('dropzone-active')
  
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0) {
    const uploadFiles = files.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }))
    
    await uploader.addFiles(uploadFiles)
  }
})

// Click to select files on dropzone
dropzone.addEventListener('click', async () => {
  await uploader.pickAndUploadFiles()
})

// Update functions
function updateStats() {
  const stats = uploader.getQueueStats()
  statsElement.textContent = `${stats.queueLength} in queue, ${stats.activeCount} active`
}

function updateUploadState(state: UploadState) {
  let uploadElement = document.getElementById(`upload-${state.fileId}`)
  
  if (!uploadElement) {
    uploadElement = createUploadElement(state)
    uploadsContainer.appendChild(uploadElement)
  }
  
  updateUploadElement(uploadElement, state)
}

function updateUploadProgress(fileId: string, progress: any) {
  const uploadElement = document.getElementById(`upload-${fileId}`)
  if (uploadElement) {
    const progressBar = uploadElement.querySelector('.progress-fill') as HTMLDivElement
    const progressText = uploadElement.querySelector('.progress-text') as HTMLDivElement
    
    if (progressBar) {
      progressBar.style.width = `${progress.percentage}%`
    }
    
    if (progressText) {
      progressText.textContent = `${formatFileSize(progress.bytesUploaded)} / ${formatFileSize(progress.bytesTotal)} (${progress.percentage.toFixed(1)}%)`
    }
  }
}

function createUploadElement(state: UploadState): HTMLDivElement {
  const element = document.createElement('div')
  element.id = `upload-${state.fileId}`
  element.className = 'upload-item'
  
  element.innerHTML = `
    <div class="upload-header">
      <div class="file-info">
        <div class="file-name">${state.file.name}</div>
        <div class="file-size">${formatFileSize(state.file.size)}</div>
      </div>
      <div class="upload-status">
        <div class="status-badge status-${state.status}">${state.status.toUpperCase()}</div>
      </div>
    </div>
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-text">0 / ${formatFileSize(state.file.size)} (0%)</div>
    </div>
    <div class="upload-controls">
      <button class="btn btn-warning btn-sm pause-btn" data-file-id="${state.fileId}">⏸️ Pause</button>
      <button class="btn btn-success btn-sm resume-btn" data-file-id="${state.fileId}" style="display: none;">▶️ Resume</button>
      <button class="btn btn-danger btn-sm cancel-btn" data-file-id="${state.fileId}">❌ Cancel</button>
    </div>
    <div class="error-message" style="display: none;"></div>
  `
  
  // Add event listeners
  const pauseBtn = element.querySelector('.pause-btn') as HTMLButtonElement
  const resumeBtn = element.querySelector('.resume-btn') as HTMLButtonElement
  const cancelBtn = element.querySelector('.cancel-btn') as HTMLButtonElement
  
  pauseBtn.addEventListener('click', () => uploader.pauseUpload(state.fileId))
  resumeBtn.addEventListener('click', () => uploader.resumeUpload(state.fileId))
  cancelBtn.addEventListener('click', () => uploader.cancelUpload(state.fileId))
  
  return element
}

function updateUploadElement(element: HTMLElement, state: UploadState) {
  const statusBadge = element.querySelector('.status-badge') as HTMLDivElement
  const pauseBtn = element.querySelector('.pause-btn') as HTMLButtonElement
  const resumeBtn = element.querySelector('.resume-btn') as HTMLButtonElement
  const cancelBtn = element.querySelector('.cancel-btn') as HTMLButtonElement
  const errorMessage = element.querySelector('.error-message') as HTMLDivElement
  
  // Update status
  statusBadge.textContent = state.status.toUpperCase()
  statusBadge.className = `status-badge status-${state.status}`
  
  // Update button visibility
  pauseBtn.style.display = state.status === 'uploading' ? 'inline-block' : 'none'
  resumeBtn.style.display = state.status === 'paused' ? 'inline-block' : 'none'
  cancelBtn.style.display = ['completed', 'cancelled'].includes(state.status) ? 'none' : 'inline-block'
  
  // Update error message
  if (state.error) {
    errorMessage.textContent = `Error: ${state.error.message}`
    errorMessage.style.display = 'block'
  } else {
    errorMessage.style.display = 'none'
  }
  
  // Update progress
  if (state.progress) {
    updateUploadProgress(state.fileId, state.progress)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Initialize
updateStats()
console.log('uploadzx vanilla example loaded') 