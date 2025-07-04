import { memo, useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useUploadzxContext } from 'uploadzx/react'
import { UploadItem } from './UploadItem'

interface UploadPopupProps {
  isVisible: boolean
  onToggle: () => void
}

export const UploadPopup = memo(({ isVisible, onToggle }: UploadPopupProps) => {
  const { uploadStates, queueStats, clearCompletedUploads } = useUploadzxContext()
  const [isMinimized, setIsMinimized] = useState(false)
  
  const uploadStatesArray = useMemo(() => Object.entries(uploadStates), [uploadStates])
  const hasUploads = useMemo(() => uploadStatesArray.length > 0, [uploadStatesArray])
  
  // Auto-show popup when uploads start
  useEffect(() => {
    if (hasUploads && !isVisible) {
      onToggle()
    }
  }, [hasUploads, isVisible, onToggle])

  // Auto-minimize when all uploads complete
  useEffect(() => {
    if (hasUploads && queueStats.activeCount === 0) {
      const allCompleted = uploadStatesArray.every(([, state]) => 
        state.status === 'completed' || state.status === 'cancelled' || state.status === 'error'
      )
      if (allCompleted) {
        setIsMinimized(true)
      }
    }
  }, [hasUploads, queueStats.activeCount, uploadStatesArray])

  if (!hasUploads) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 30,
            mass: 0.8
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '400px',
            maxHeight: isMinimized ? '80px' : '500px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <motion.div
            style={{
              padding: '16px',
              borderBottom: isMinimized ? 'none' : '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              borderRadius: '12px 12px 0 0',
              cursor: 'pointer'
            }}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <motion.div
                  animate={{ rotate: isMinimized ? 0 : 90 }}
                  transition={{ duration: 0.2 }}
                  style={{ fontSize: '16px' }}
                >
                  ▶️
                </motion.div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Uploads ({uploadStatesArray.length})
                  </div>
                  {uploadStatesArray.some(([, state]) => state.status === 'completed') && (
                    <button onClick={() => clearCompletedUploads()}>Clear completed</button>
                  )}
                  {queueStats.activeCount > 0 && (
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {queueStats.activeCount} active, {queueStats.queueLength} queued
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {queueStats.activeCount > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#646cff',
                      borderRadius: '50%'
                    }}
                  />
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    opacity: 0.6
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '8px'
                }}
              >
                <AnimatePresence mode="popLayout">
                  {uploadStatesArray.map(([fileId, state]) => (
                    <UploadItem key={fileId} fileId={fileId} state={state} />
                  ))}
                </AnimatePresence>
                
                {uploadStatesArray.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      opacity: 0.6
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                    <div>No uploads yet</div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

UploadPopup.displayName = 'UploadPopup' 