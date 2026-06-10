import { Tooltip } from '@base-ui/react/tooltip'
import { useMemo, useState } from 'react'
import { useQueueStats, useUnfinishedUploads, useUploadzxState } from 'uploadzx/react'
import { useUploadCounts, useUploadIds } from '../../hooks/useUploadSelectors'
import { DashboardHeader } from './DashboardHeader'
import { MetricsStrip } from './MetricsStrip'
import { UploadWorkspace } from './UploadWorkspace'
import type { DashboardView, UploadMetrics } from './types'
import styles from './Dashboard.module.css'

/**
 * The dashboard shell subscribes only to slices that change *infrequently*:
 *  - the ordered id list (changes on add/remove/clear),
 *  - aggregate status counts (changes on a status transition),
 *  - queue stats and the unfinished list.
 *
 * None of these update on a raw progress tick, so the shell — and the list
 * layout — stays put while individual rows update themselves. The continuously
 * ticking value (average progress) is read lower down, inside the progress bar.
 */
export function UploadDashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('upload')
  const [compactRows, setCompactRows] = useState(true)

  const { isInitialized } = useUploadzxState()
  const ids = useUploadIds()
  const counts = useUploadCounts()
  const { queueStats } = useQueueStats()
  const { unfinishedUploads } = useUnfinishedUploads()

  const metrics = useMemo<UploadMetrics>(
    () => ({
      active: queueStats.activeCount,
      queued: queueStats.queueLength,
      completed: counts.completed,
      failed: counts.failed,
      unfinished: unfinishedUploads.length,
      total: counts.total,
    }),
    [
      queueStats.activeCount,
      queueStats.queueLength,
      counts.completed,
      counts.failed,
      counts.total,
      unfinishedUploads.length,
    ]
  )

  return (
    <Tooltip.Provider delay={250}>
      <div className={styles.appShell}>
        <DashboardHeader
          metrics={metrics}
          compactRows={compactRows}
          onCompactRowsChange={setCompactRows}
        />
        <MetricsStrip metrics={metrics} />

        {isInitialized ? (
          <UploadWorkspace
            activeView={activeView}
            compactRows={compactRows}
            metrics={metrics}
            ids={ids}
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
