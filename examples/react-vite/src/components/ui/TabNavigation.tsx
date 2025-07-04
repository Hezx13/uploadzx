import { memo } from 'react'

export type TabType = 'picker' | 'dropzone' | 'unfinished'

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export const TabNavigation = memo(({ activeTab, onTabChange }: TabNavigationProps) => {
    console.log('activeTab', activeTab)
  return (
    <div style={{ marginBottom: '20px' }} className="upload-controls">
      <button
        className={`btn`}
        onClick={() => onTabChange('picker')}
        style={{
          backgroundColor: activeTab === 'picker' ? '#646cff' : 'transparent',
          color: activeTab === 'picker' ? 'white' : 'inherit',
        }}
      >
        📁 File Picker
      </button>
      <button
        className={`btn ${activeTab === 'dropzone' ? 'btn-primary' : 'btn'}`}
        onClick={() => onTabChange('dropzone')}
        style={{
          backgroundColor: activeTab === 'dropzone' ? '#646cff' : 'transparent',
          color: activeTab === 'dropzone' ? 'white' : 'inherit',
        }}
      >
        🎯 Drag & Drop
      </button>
      <button
        className={`btn ${activeTab === 'unfinished' ? 'btn-primary' : 'btn'}`}
        onClick={() => onTabChange('unfinished')}
        style={{
          backgroundColor: activeTab === 'unfinished' ? '#646cff' : 'transparent',
          color: activeTab === 'unfinished' ? 'white' : 'inherit',
        }}
      >
        📋 Unfinished Uploads
      </button>
    </div>
  )
})

TabNavigation.displayName = 'TabNavigation' 