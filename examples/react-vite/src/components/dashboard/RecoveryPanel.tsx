import { Button } from '@base-ui/react/button'
import { RotateCcw, ShieldCheck } from 'lucide-react'
import { useUnfinishedUploads, useUploadzxActions } from 'uploadzx/react'
import { formatFileSize } from '../../utils/formatters'
import styles from './Dashboard.module.css'

export function RecoveryPanel() {
  const { unfinishedUploads } = useUnfinishedUploads()
  const { restoreUnfinishedUpload } = useUploadzxActions()

  return (
    <section className={styles.recoveryPanel} aria-labelledby="recovery-panel-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="recovery-panel-title" className={styles.panelTitle}>
            Recovery
          </h2>
          <p className={styles.panelDescription}>Interrupted browser sessions can be resumed here.</p>
        </div>
      </div>

      {unfinishedUploads.length > 0 ? (
        <div className={styles.recoveryList}>
          {unfinishedUploads.map((upload) => {
            const percentage = upload.bytesUploaded ? Math.round((upload.bytesUploaded / upload.size) * 100) : 0

            return (
              <div key={upload.id} className={styles.recoveryItem}>
                <div className={styles.recoveryIcon}>
                  <ShieldCheck size={17} />
                </div>
                <div className={styles.fileMeta}>
                  <div className={styles.fileName}>{upload.name}</div>
                  <div className={styles.fileDetails}>
                    {formatFileSize(upload.size)} · {percentage}% saved
                  </div>
                </div>
                <Button className={styles.smallButton} onClick={() => restoreUnfinishedUpload(upload.id)}>
                  <RotateCcw size={14} />
                  Restore
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <ShieldCheck size={28} />
          <span>No unfinished uploads</span>
        </div>
      )}
    </section>
  )
}
