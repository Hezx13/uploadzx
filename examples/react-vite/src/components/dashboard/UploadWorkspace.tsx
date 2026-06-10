import { Tabs } from '@base-ui/react/tabs'
import { useMemo } from 'react'
import { ActivityPanel } from './ActivityPanel'
import { DropzonePanel } from './DropzonePanel'
import { QueueToolbar } from './QueueToolbar'
import { RecoveryPanel } from './RecoveryPanel'
import type { DashboardView, UploadMetrics } from './types'
import styles from './Dashboard.module.css'

interface UploadWorkspaceProps {
  activeView: DashboardView
  compactRows: boolean
  metrics: UploadMetrics
  ids: string[]
  onViewChange: (view: DashboardView) => void
}

export function UploadWorkspace({
  activeView,
  compactRows,
  metrics,
  ids,
  onViewChange,
}: UploadWorkspaceProps) {
  // Preview list for the Upload tab. Memoized so it only changes when the id set
  // changes, keeping ActivityPanel's props referentially stable across ticks.
  const previewIds = useMemo(() => ids.slice(0, 5), [ids])

  return (
    <Tabs.Root
      className={styles.workspace}
      value={activeView}
      onValueChange={value => onViewChange(value as DashboardView)}
    >
      <div className={styles.workspaceBar}>
        <Tabs.List className={styles.tabsList} aria-label="Dashboard views">
          <Tabs.Tab className={styles.tab} value="upload">
            Upload
          </Tabs.Tab>
          <Tabs.Tab className={styles.tab} value="activity">
            Activity
          </Tabs.Tab>
          <Tabs.Tab className={styles.tab} value="recovery">
            Recovery
            {metrics.unfinished > 0 && <span className={styles.tabBadge}>{metrics.unfinished}</span>}
          </Tabs.Tab>
          <Tabs.Indicator className={styles.tabIndicator} />
        </Tabs.List>

        <QueueToolbar completedCount={metrics.completed} />
      </div>

      <Tabs.Panel className={styles.tabPanel} value="upload" keepMounted>
        <div className={styles.workspaceGrid}>
          <DropzonePanel />
          <ActivityPanel ids={previewIds} compactRows={compactRows} />
        </div>
      </Tabs.Panel>

      <Tabs.Panel className={styles.tabPanel} value="activity" keepMounted>
        <ActivityPanel ids={ids} compactRows={compactRows} />
      </Tabs.Panel>

      <Tabs.Panel className={styles.tabPanel} value="recovery" keepMounted>
        <RecoveryPanel />
      </Tabs.Panel>
    </Tabs.Root>
  )
}
