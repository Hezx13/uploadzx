import { FileUp } from 'lucide-react'
import { memo } from 'react'
import { UploadItemRow } from './UploadItemRow'
import styles from './Dashboard.module.css'

interface ActivityPanelProps {
  /** Only the ids — never the state objects. Each row subscribes to its own id. */
  ids: string[]
  compactRows: boolean
}

/**
 * Renders the list from ids alone. Because it receives ids (not state), it
 * re-renders only when the set of files changes — a progress tick on any file
 * never reaches this component; it's handled inside that file's row.
 */
export const ActivityPanel = memo(({ ids, compactRows }: ActivityPanelProps) => {
  return (
    <section className={styles.activityPanel} aria-labelledby="activity-panel-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="activity-panel-title" className={styles.panelTitle}>
            Activity
          </h2>
          <p className={styles.panelDescription}>
            {ids.length} file{ids.length === 1 ? '' : 's'} tracked in this session.
          </p>
        </div>
      </div>

      {ids.length > 0 ? (
        <div className={styles.uploadList}>
          {ids.map(fileId => (
            <UploadItemRow key={fileId} fileId={fileId} compact={compactRows} />
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
})

ActivityPanel.displayName = 'ActivityPanel'
