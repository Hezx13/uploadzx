import { Tooltip } from '@base-ui/react/tooltip'
import { useMemo, useState } from 'react'
import { useQueueStats, useUnfinishedUploads, useUploadStates, useUploadzxState } from 'uploadzx/react'
import { DashboardHeader } from './DashboardHeader'
import { MetricsStrip } from './MetricsStrip'
import { UploadWorkspace } from './UploadWorkspace'
import type { DashboardView, UploadMetrics } from './types'
import styles from './Dashboard.module.css'

function buildMetrics(
  uploadStates: ReturnType<typeof useUploadStates>['uploadStates'],
  queueStats: ReturnType<typeof useQueueStats>['queueStats'],
  unfinishedCount: number,
): UploadMetrics {
  const uploads = Object.values(uploadStates)
  const completed = uploads.filter((upload) => upload.status === 'completed').length
  const failed = uploads.filter((upload) => upload.status === 'error').length
  const progressTotal = uploads.reduce((total, upload) => {
    if (upload.status === 'completed') return total + 100
    return total + (upload.progress?.percentage ?? 0)
  }, 0)

  return {
    active: queueStats.activeCount,
    queued: queueStats.queueLength,
    completed,
    failed,
    unfinished: unfinishedCount,
    total: uploads.length,
    averageProgress: uploads.length > 0 ? progressTotal / uploads.length : 0,
  }
}

export function UploadDashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('upload')
  const [compactRows, setCompactRows] = useState(true)
  const { isInitialized } = useUploadzxState()
  const { uploadStates } = useUploadStates()
  const { queueStats } = useQueueStats()
  const { unfinishedUploads } = useUnfinishedUploads()

  const uploads = useMemo(() => Object.entries(uploadStates).reverse(), [uploadStates])
  const metrics = useMemo(
    () => buildMetrics(uploadStates, queueStats, unfinishedUploads.length),
    [queueStats, unfinishedUploads.length, uploadStates],
  )

  return (
    <Tooltip.Provider delay={250}>
      <div className={styles.appShell}>
        <DashboardHeader metrics={metrics} compactRows={compactRows} onCompactRowsChange={setCompactRows} />
        <MetricsStrip metrics={metrics} />

        {isInitialized ? (
          <UploadWorkspace
            activeView={activeView}
            compactRows={compactRows}
            metrics={metrics}
            uploads={uploads}
            onViewChange={setActiveView}
          />
        ) : (
          <div className={styles.initializingPanel}>
            <div className={styles.loadingPulse} />
            <div>
              <h2>Preparing uploader</h2>
              <p>File handles and resumable queue state are being initialized.</p>
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  )
}
