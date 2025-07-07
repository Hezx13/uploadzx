import { memo } from 'react'
import { useUnfinishedUploads, useUploadzxActions } from 'uploadzx/react'

export const UnfinishedUploads = memo(() => {
  const { unfinishedUploads } = useUnfinishedUploads()
  const { restoreUnfinishedUpload } = useUploadzxActions()
  
  if (unfinishedUploads.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <div style={{ fontSize: '18px', marginBottom: '8px' }}>No unfinished uploads</div>
        <div style={{ fontSize: '14px' }}>Upload some files to see them here when interrupted</div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px' }}>📋 Unfinished Uploads ({unfinishedUploads.length})</h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        {unfinishedUploads.map((upload) => (
          <div 
            key={upload.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: '#f9fafb'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px' }}>📄</div>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{upload.name}</div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                  {upload.bytesUploaded ? `${Math.round((upload.bytesUploaded / upload.size) * 100)}% uploaded` : 'Ready to resume'}
                </div>
              </div>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => restoreUnfinishedUpload(upload.id)}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              ▶️ Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  )
})

UnfinishedUploads.displayName = 'UnfinishedUploads' 