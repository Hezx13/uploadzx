import { Button } from '@base-ui/react/button'
import { UploadCloud } from 'lucide-react'
import { memo, useCallback } from 'react'
import { UploadDropzone, useUploadzxActions, type UploadFile } from 'uploadzx/react'
import styles from './Dashboard.module.css'

export const DropzonePanel = memo(() => {
  const { pickAndUploadFiles } = useUploadzxActions()

  const handleFilesDrop = useCallback((files: UploadFile[]) => {
    console.log('Files dropped:', files)
  }, [])

  return (
    <section className={styles.dropzonePanel} aria-labelledby="upload-panel-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="upload-panel-title" className={styles.panelTitle}>
            Intake
          </h2>
          <p className={styles.panelDescription}>Drop files into the queue or use the picker.</p>
        </div>
      </div>

      <UploadDropzone
        className={styles.dropzone}
        activeClassName={styles.dropzoneActive}
        onFilesDrop={handleFilesDrop}
        clickable
      >
        <UploadCloud className={styles.dropzoneIcon} size={34} />
        <div className={styles.dropzoneTitle}>Drop files here</div>
        <div className={styles.dropzoneDescription}>Resumable tus uploads start automatically.</div>
      </UploadDropzone>

      <Button className={styles.fullWidthButton} onClick={pickAndUploadFiles}>
        Browse files
      </Button>
    </section>
  )
})

DropzonePanel.displayName = 'DropzonePanel'
