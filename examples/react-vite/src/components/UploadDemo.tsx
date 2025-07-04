import { useState, useCallback } from 'react'
import { useUploadzxContext } from 'uploadzx/react'
import { 
  TabNavigation, 
  FilePickerControls, 
  DropzoneSection, 
  UnfinishedUploads, 
  QueueStats,
  UploadPopup,
  type TabType 
} from './index'
import { useUploadPopup } from '../hooks/useUploadPopup'

export const UploadDemo = () => {
  const [activeTab, setActiveTab] = useState<TabType>('picker')
  const { isInitialized } = useUploadzxContext()
  const { isVisible, togglePopup } = useUploadPopup()

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
  }, [])

  if (!isInitialized) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ fontSize: '32px' }}>⏳</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Initializing uploader...</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>Setting up file storage and resumable uploads</div>
      </div>
    )
  }

  return (
    <div>
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'unfinished' && <UnfinishedUploads />}
      {activeTab === 'picker' && <FilePickerControls />}
      {activeTab === 'dropzone' && <DropzoneSection />}

      <QueueStats />
      
      {/* Upload Popup - Google Drive style */}
      <UploadPopup isVisible={isVisible} onToggle={togglePopup} />
      
      {/* Upload Progress Toggle Button */}
      <button
        onClick={togglePopup}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          padding: '12px 16px',
          backgroundColor: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 999
        }}
        title="Toggle upload progress"
      >
        📊 Upload Progress
      </button>
    </div>
  )
} 