import { Progress } from '@base-ui/react/progress'
import { Activity, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'
import { memo } from 'react'
import { useQueueAverageProgress } from '../../hooks/useUploadSelectors'
import type { UploadMetrics } from './types'
import styles from './Dashboard.module.css'

interface MetricsStripProps {
  metrics: UploadMetrics
}

const metricCards = [
  { key: 'active', label: 'Active', icon: Activity },
  { key: 'queued', label: 'Queued', icon: Clock3 },
  { key: 'completed', label: 'Complete', icon: CheckCircle2 },
  { key: 'failed', label: 'Failed', icon: AlertCircle },
] as const

/**
 * The ticking aggregate, isolated into its own leaf. It subscribes to the live
 * average via `useQueueAverageProgress` (rounded → updates ~100×, not per byte).
 * Keeping it separate means the metric cards above don't re-render when only the
 * percentage moves.
 */
const QueueProgressBar = memo(() => {
  const averageProgress = useQueueAverageProgress()
  return (
    <div className={styles.progressSummary}>
      <div>
        <div className={styles.metricLabel}>Queue progress</div>
        <div className={styles.progressValue}>{averageProgress}%</div>
      </div>
      <Progress.Root className={styles.progressRoot} value={averageProgress}>
        <Progress.Track className={styles.progressTrack}>
          <Progress.Indicator className={styles.progressIndicator} />
        </Progress.Track>
      </Progress.Root>
    </div>
  )
})

QueueProgressBar.displayName = 'QueueProgressBar'

/**
 * Count cards re-render only when a count changes (the `metrics` prop is built
 * from count selectors upstream). The live percentage is delegated to
 * {@link QueueProgressBar} so it doesn't drag the cards into per-tick renders.
 */
export const MetricsStrip = memo(({ metrics }: MetricsStripProps) => {
  return (
    <section className={styles.metricsGrid} aria-label="Upload metrics">
      {metricCards.map(({ key, label, icon: Icon }) => (
        <div className={styles.metricCard} key={key}>
          <div className={styles.metricLabel}>
            <Icon size={15} />
            {label}
          </div>
          <div className={styles.metricValue}>{metrics[key]}</div>
        </div>
      ))}

      <QueueProgressBar />
    </section>
  )
})

MetricsStrip.displayName = 'MetricsStrip'
