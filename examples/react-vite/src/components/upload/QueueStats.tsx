import { memo } from 'react'
import { useQueueStats } from 'uploadzx/react'

export const QueueStats = memo(() => {
  const {queueStats } = useQueueStats()
  
  return (
    <div className="stats" style={{ 
      padding: '12px 16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <span style={{ fontSize: '16px' }}>📊</span>
      <strong>Queue Stats:</strong> 
      <span>{queueStats.queueLength} files in queue</span>
      {queueStats.activeCount > 0 && (
        <span style={{ 
          marginLeft: '8px',
          padding: '2px 8px',
          backgroundColor: '#646cff',
          color: 'white',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          ACTIVE
        </span>
      )}
    </div>
  )
})

QueueStats.displayName = 'QueueStats' 