import { memo } from 'react'
import { motion } from 'motion/react'
import { useUploadItem, type UploadState } from 'uploadzx/react'
import { formatFileSize, getStatusColor } from '../../utils/formatters'

// Upload item controls component
const UploadItemControls = memo(({ 
  canPause,
  canResume,
  canCancel,
  onPause, 
  onResume, 
  onCancel 
}: { 
  canPause: boolean
  canResume: boolean
  canCancel: boolean
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}) => (
  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
    {canPause && (
      <button
        className="btn btn-warning"
        onClick={onPause}
        style={{ fontSize: '12px', padding: '4px 8px', minWidth: 'auto' }}
        title="Pause"
      >
        ⏸️
      </button>
    )}
    
    {canResume && (
      <button
        className="btn btn-success"
        onClick={onResume}
        style={{ fontSize: '12px', padding: '4px 8px', minWidth: 'auto' }}
        title="Resume"
      >
        ▶️
      </button>
    )}
    
    {canCancel && (
      <button
        className="btn btn-danger"
        onClick={onCancel}
        style={{ fontSize: '12px', padding: '4px 8px', minWidth: 'auto' }}
        title="Cancel"
      >
        ❌
      </button>
    )}
  </div>
))

UploadItemControls.displayName = 'UploadItemControls'

// Upload item progress component
const UploadItemProgress = memo(({ 
  progress, 
  status 
}: { 
  progress?: { percentage: number; bytesUploaded: number; bytesTotal: number }
  status: string 
}) => {
  if (!progress) return null

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ 
        width: '100%', 
        height: '4px', 
        backgroundColor: '#e5e7eb', 
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <motion.div
          style={{
            height: '100%',
            backgroundColor: getStatusColor(status),
            borderRadius: '2px',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '11px', 
        marginTop: '4px', 
        opacity: 0.7 
      }}>
        <span>{formatFileSize(progress.bytesUploaded)} / {formatFileSize(progress.bytesTotal)}</span>
        <span>{progress.percentage.toFixed(1)}%</span>
      </div>
    </div>
  )
})

UploadItemProgress.displayName = 'UploadItemProgress'

// Upload item error component
const UploadItemError = memo(({ error }: { error: Error }) => (
  <motion.div 
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    style={{ 
      marginTop: '8px', 
      color: '#ef4444', 
      fontSize: '12px', 
      padding: '8px', 
      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
      borderRadius: '4px',
      border: '1px solid rgba(239, 68, 68, 0.2)'
    }}
  >
    <strong>Error:</strong> {error.message}
  </motion.div>
))

UploadItemError.displayName = 'UploadItemError'

// Status icon component
const StatusIcon = memo(({ status }: { status: string }) => {
  const getIcon = () => {
    switch (status) {
      case 'completed': return '✅'
      case 'error': return '❌'
      case 'uploading': return '⬆️'
      case 'paused': return '⏸️'
      case 'cancelled': return '🚫'
      default: return '📄'
    }
  }

  return (
    <motion.div
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ fontSize: '16px', minWidth: '20px' }}
    >
      {getIcon()}
    </motion.div>
  )
})

StatusIcon.displayName = 'StatusIcon'

// Main upload item component
export const UploadItem = memo(({ fileId, state }: { fileId: string; state: UploadState }) => {
  const { 
    handlePause, 
    handleResume, 
    handleCancel, 
    canPause, 
    canResume, 
    canCancel, 
    progressPercentage 
  } = useUploadItem(fileId, state)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        marginBottom: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <StatusIcon status={state.status} />
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '14px',
                marginBottom: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {state.file.name}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {formatFileSize(state.file.size)}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  color: getStatusColor(state.status),
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: `${getStatusColor(state.status)}20`,
                  borderRadius: '4px',
                  border: `1px solid ${getStatusColor(state.status)}40`
                }}
              >
                {state.status}
              </div>
              
              <UploadItemControls 
                canPause={canPause}
                canResume={canResume}
                canCancel={canCancel}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
              />
            </div>
          </div>
          
          <UploadItemProgress progress={state.progress} status={state.status} />
          {state.error && <UploadItemError error={state.error} />}
        </div>
      </div>
    </motion.div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  const prevState = prevProps.state
  const nextState = nextProps.state
  
  return (
    prevState.status === nextState.status &&
    prevState.progress?.percentage === nextState.progress?.percentage &&
    prevState.progress?.bytesUploaded === nextState.progress?.bytesUploaded &&
    prevState.error?.message === nextState.error?.message
  )
})

UploadItem.displayName = 'UploadItem' 