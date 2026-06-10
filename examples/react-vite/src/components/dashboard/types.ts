export type DashboardView = 'upload' | 'activity' | 'recovery'

/**
 * Infrequently-changing dashboard metrics. Note there is intentionally no
 * `averageProgress` here: that ticks continuously and is read directly by the
 * progress bar leaf (`useQueueAverageProgress`), so it never forces the whole
 * dashboard to re-render.
 */
export interface UploadMetrics {
  active: number
  queued: number
  completed: number
  failed: number
  unfinished: number
  total: number
}
