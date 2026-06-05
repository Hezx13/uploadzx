import { Progress } from '@base-ui/react/progress'
import { AlertCircle, CheckCircle2, File, Pause, Play, X } from 'lucide-react'
import { memo } from 'react'
import { formatUploadSpeed } from 'uploadzx'
import { useUploadItem, type UploadState } from 'uploadzx/react'
import { formatFileSize } from '../../utils/formatters'
import { IconButton } from './IconButton'
import styles from './Dashboard.module.css'

interface UploadItemRowProps {
  fileId: string
  state: UploadState
  compact: boolean
}

const statusIcon = {
  completed: CheckCircle2,
  error: AlertCircle,
  uploading: File,
  paused: Pause,
  cancelled: X,
  pending: File,
} as const

function getProgressValue(state: UploadState) {
  if (state.status === 'completed') return 100
  return state.progress?.percentage ?? 0
}

export const UploadItemRow = memo(({ fileId, state, compact }: UploadItemRowProps) => {
  const { handlePause, handleResume, handleCancel, canPause, canResume, canCancel } = useUploadItem(fileId)
  const progress = getProgressValue(state)
  const StatusIcon = statusIcon[state.status as keyof typeof statusIcon] ?? File

  return (
    <article className={[styles.uploadRow, compact ? styles.uploadRowCompact : ''].filter(Boolean).join(' ')}>
      <div className={styles.uploadFileIcon} data-status={state.status}>
        <StatusIcon size={17} />
      </div>

      <div className={styles.uploadRowBody}>
        <div className={styles.uploadRowTop}>
          <div className={styles.fileMeta}>
            <div className={styles.fileName}>{state.file.name}</div>
            <div className={styles.fileDetails}>
              {formatFileSize(state.file.size)}
              {state.progress?.bytesPerSecond ? ` · ${formatUploadSpeed(state.progress.bytesPerSecond)}` : ''}
            </div>
          </div>

          <div className={styles.rowActions}>
            <span className={styles.statusPill} data-status={state.status}>
              {state.status}
            </span>
            {canPause && (
              <IconButton label="Pause upload" onClick={handlePause}>
                <Pause size={15} />
              </IconButton>
            )}
            {canResume && (
              <IconButton label="Resume upload" onClick={handleResume}>
                <Play size={15} />
              </IconButton>
            )}
            {canCancel && (
              <IconButton label="Cancel upload" onClick={handleCancel} variant="danger">
                <X size={15} />
              </IconButton>
            )}
          </div>
        </div>

        <Progress.Root className={styles.rowProgressRoot} value={progress}>
          <Progress.Track className={styles.rowProgressTrack}>
            <Progress.Indicator className={styles.rowProgressIndicator} data-status={state.status} />
          </Progress.Track>
        </Progress.Root>

        {state.error && <div className={styles.errorText}>{state.error.message}</div>}
      </div>
    </article>
  )
})

UploadItemRow.displayName = 'UploadItemRow'
