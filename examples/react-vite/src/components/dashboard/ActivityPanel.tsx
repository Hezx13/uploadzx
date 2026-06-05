import { FileUp } from 'lucide-react'
import type { UploadState } from 'uploadzx/react'
import { UploadItemRow } from './UploadItemRow'
import styles from './Dashboard.module.css'

interface ActivityPanelProps {
  uploads: Array<[string, UploadState]>
  compactRows: boolean
}

export function ActivityPanel({ uploads, compactRows }: ActivityPanelProps) {
  return (
    <section className={styles.activityPanel} aria-labelledby="activity-panel-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="activity-panel-title" className={styles.panelTitle}>
            Activity
          </h2>
          <p className={styles.panelDescription}>{uploads.length} file{uploads.length === 1 ? '' : 's'} tracked in this session.</p>
        </div>
      </div>

      {uploads.length > 0 ? (
        <div className={styles.uploadList}>
          {uploads.map(([fileId, state]) => (
            <UploadItemRow key={fileId} fileId={fileId} state={state} compact={compactRows} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <FileUp size={28} />
          <span>No uploads yet</span>
        </div>
      )}
    </section>
  )
}
