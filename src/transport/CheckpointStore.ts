import type { ResumeData } from './types';

/**
 * Holds the resume bookkeeping for a single upload: the driver's opaque resume
 * checkpoint and the number of bytes confirmed uploaded. Extracted from
 * UploadController so resume/persistence concerns live in one small place rather
 * than smeared across the controller's lifecycle methods.
 */
export class CheckpointStore {
  private resumeData?: ResumeData;
  private bytesUploaded = 0;

  /** Seed from persisted state when resuming a paused/failed upload. */
  hydrate(resumeData: ResumeData | undefined, bytesUploaded: number): void {
    this.resumeData = resumeData;
    this.bytesUploaded = bytesUploaded;
  }

  /** Record a fresh checkpoint reported by the driver. */
  capture(resumeData: ResumeData): void {
    this.resumeData = resumeData;
  }

  /** Record progress so a later resume knows where to pick up. */
  recordBytes(bytesUploaded: number): void {
    this.bytesUploaded = bytesUploaded;
  }

  /** Drop all resume state (e.g. on cancel or a non-resumable restart). */
  clear(): void {
    this.resumeData = undefined;
    this.bytesUploaded = 0;
  }

  get resume(): ResumeData | undefined {
    return this.resumeData;
  }

  get bytes(): number {
    return this.bytesUploaded;
  }
}
