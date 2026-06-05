import { Tabs } from '@base-ui/react/tabs'
import type { UploadState } from 'uploadzx/react'
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
  uploads: Array<[string, UploadState]>
  onViewChange: (view: DashboardView) => void
}

export function UploadWorkspace({ activeView, compactRows, metrics, uploads, onViewChange }: UploadWorkspaceProps) {
  return (
    <Tabs.Root
      className={styles.workspace}
      value={activeView}
      onValueChange={(value) => onViewChange(value as DashboardView)}
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
          <ActivityPanel uploads={uploads.slice(0, 5)} compactRows={compactRows} />
        </div>
      </Tabs.Panel>

      <Tabs.Panel className={styles.tabPanel} value="activity" keepMounted>
        <ActivityPanel uploads={uploads} compactRows={compactRows} />
      </Tabs.Panel>

      <Tabs.Panel className={styles.tabPanel} value="recovery" keepMounted>
        <RecoveryPanel />
      </Tabs.Panel>
    </Tabs.Root>
  )
}
