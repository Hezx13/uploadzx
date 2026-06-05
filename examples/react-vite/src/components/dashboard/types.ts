export type DashboardView = 'upload' | 'activity' | 'recovery'

export interface UploadMetrics {
  active: number
  queued: number
  completed: number
  failed: number
  unfinished: number
  total: number
  averageProgress: number
}
