import { Progress } from '@base-ui/react/progress'
import { Activity, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'
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

export function MetricsStrip({ metrics }: MetricsStripProps) {
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

      <div className={styles.progressSummary}>
        <div>
          <div className={styles.metricLabel}>Queue progress</div>
          <div className={styles.progressValue}>{Math.round(metrics.averageProgress)}%</div>
        </div>
        <Progress.Root className={styles.progressRoot} value={metrics.averageProgress}>
          <Progress.Track className={styles.progressTrack}>
            <Progress.Indicator className={styles.progressIndicator} />
          </Progress.Track>
        </Progress.Root>
      </div>
    </section>
  )
}
