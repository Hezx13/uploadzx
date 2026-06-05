import { Dialog } from '@base-ui/react/dialog'
import { Switch } from '@base-ui/react/switch'
import { X } from 'lucide-react'
import styles from './Dashboard.module.css'

interface SettingsDialogProps {
  compactRows: boolean
  onCompactRowsChange: (value: boolean) => void
}

export function SettingsDialog({ compactRows, onCompactRowsChange }: SettingsDialogProps) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.dialogBackdrop} />
      <Dialog.Popup className={styles.dialogPopup}>
        <div className={styles.dialogHeader}>
          <div>
            <Dialog.Title className={styles.dialogTitle}>Dashboard settings</Dialog.Title>
            <Dialog.Description className={styles.dialogDescription}>
              Tune the example surface without changing uploader behavior.
            </Dialog.Description>
          </div>
          <Dialog.Close className={styles.iconButton} aria-label="Close settings">
            <X size={18} />
          </Dialog.Close>
        </div>

        <div className={styles.settingRow}>
          <div>
            <div className={styles.settingTitle}>Compact activity rows</div>
            <div className={styles.settingDescription}>Show more queue items in the activity panel.</div>
          </div>
          <Switch.Root
            className={styles.switchRoot}
            checked={compactRows}
            onCheckedChange={onCompactRowsChange}
            aria-label="Toggle compact activity rows"
          >
            <Switch.Thumb className={styles.switchThumb} />
          </Switch.Root>
        </div>

        <div className={styles.endpointBox}>
          <span>Endpoint</span>
          <code>https://tusd.tusdemo.net/files/</code>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  )
}
