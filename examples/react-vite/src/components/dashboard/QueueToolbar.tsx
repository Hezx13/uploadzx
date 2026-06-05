import { Toolbar } from '@base-ui/react/toolbar'
import { Ban, Pause, Play, RotateCcw, Upload } from 'lucide-react'
import { useQueueActions, useUploadzxActions } from 'uploadzx/react'
import styles from './Dashboard.module.css'

interface QueueToolbarProps {
  completedCount: number
}

export function QueueToolbar({ completedCount }: QueueToolbarProps) {
  const { handlePickFiles, handlePauseAll, handleResumeAll, handleCancelAll, canPauseAll, hasQueuedUploads } =
    useQueueActions()
  const { clearCompletedUploads } = useUploadzxActions()

  return (
    <Toolbar.Root className={styles.toolbar} aria-label="Queue controls">
      <Toolbar.Group className={styles.toolbarGroup}>
        <Toolbar.Button className={styles.toolbarPrimary} onClick={handlePickFiles}>
          <Upload size={15} />
          Add files
        </Toolbar.Button>
        <Toolbar.Button className={styles.toolbarButton} onClick={handlePauseAll} disabled={!canPauseAll}>
          <Pause size={15} />
          Pause
        </Toolbar.Button>
        <Toolbar.Button className={styles.toolbarButton} onClick={handleResumeAll}>
          <Play size={15} />
          Resume
        </Toolbar.Button>
      </Toolbar.Group>

      <Toolbar.Separator className={styles.toolbarSeparator} />

      <Toolbar.Group className={styles.toolbarGroup}>
        <Toolbar.Button className={styles.toolbarButton} onClick={clearCompletedUploads} disabled={completedCount === 0}>
          <RotateCcw size={15} />
          Clear
        </Toolbar.Button>
        <Toolbar.Button className={styles.toolbarDanger} onClick={handleCancelAll} disabled={!hasQueuedUploads && !canPauseAll}>
          <Ban size={15} />
          Cancel
        </Toolbar.Button>
      </Toolbar.Group>
    </Toolbar.Root>
  )
}
