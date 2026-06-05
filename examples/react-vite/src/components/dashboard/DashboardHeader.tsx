import { Button } from '@base-ui/react/button'
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { MoreHorizontal, Pause, Play, RotateCcw, Settings, Trash2, Upload } from 'lucide-react'
import { useQueueActions, useUploadzxActions } from 'uploadzx/react'
import { IconButton } from './IconButton'
import { SettingsDialog } from './SettingsDialog'
import type { UploadMetrics } from './types'
import styles from './Dashboard.module.css'

interface DashboardHeaderProps {
  metrics: UploadMetrics
  compactRows: boolean
  onCompactRowsChange: (value: boolean) => void
}

export function DashboardHeader({ metrics, compactRows, onCompactRowsChange }: DashboardHeaderProps) {
  const { handlePickFiles, handlePauseAll, handleResumeAll, handleCancelAll, canPauseAll } = useQueueActions()
  const { clearCompletedUploads } = useUploadzxActions()
  const canClear = metrics.completed > 0
  const canCancel = metrics.active > 0 || metrics.queued > 0

  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>uploadzx React example</div>
        <h1 className={styles.title}>Upload operations</h1>
      </div>

      <div className={styles.headerActions}>
        <Button className={styles.primaryButton} onClick={handlePickFiles}>
          <Upload size={16} />
          Upload files
        </Button>

        <IconButton label="Pause all uploads" onClick={handlePauseAll} disabled={!canPauseAll}>
          <Pause size={17} />
        </IconButton>
        <IconButton label="Resume all uploads" onClick={handleResumeAll}>
          <Play size={17} />
        </IconButton>

        <Menu.Root>
          <Menu.Trigger className={styles.iconButton} aria-label="More actions">
            <MoreHorizontal size={18} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="end">
              <Menu.Popup className={styles.menuPopup}>
                <Menu.Item className={styles.menuItem} onClick={() => clearCompletedUploads()} disabled={!canClear}>
                  <RotateCcw size={15} />
                  Clear completed
                </Menu.Item>
                <Menu.Item className={styles.menuItemDanger} onClick={handleCancelAll} disabled={!canCancel}>
                  <Trash2 size={15} />
                  Cancel queue
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Dialog.Root>
          <Dialog.Trigger className={styles.iconButton} aria-label="Open dashboard settings">
            <Settings size={18} />
          </Dialog.Trigger>
          <SettingsDialog compactRows={compactRows} onCompactRowsChange={onCompactRowsChange} />
        </Dialog.Root>
      </div>
    </header>
  )
}
