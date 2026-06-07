/**
 * ProgressTracker handles the calculation of upload progress percentage and speed.
 * It separates progress tracking concerns from transport-specific logic.
 */
/**
 * Progress snapshot produced by the tracker. Note it intentionally does NOT
 * include `fileId` — that is the caller's concern. The tracker computes math, not
 * identity.
 */
export interface ProgressSnapshot {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
  bytesPerSecond: number;
}

export class ProgressTracker {
  private trackSpeed: boolean;
  private lastSpeed = 0;
  private lastProgressUpdate?: {
    bytesUploaded: number;
    timestamp: number;
  };

  constructor(trackSpeed = false) {
    this.trackSpeed = trackSpeed;
  }

  /**
   * Initialize progress tracking for a new or resumed upload.
   * Call this when starting or resuming.
   */
  initialize(bytesUploaded = 0): void {
    this.lastSpeed = 0;
    if (this.trackSpeed) {
      this.lastProgressUpdate = {
        bytesUploaded,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Update progress and calculate percentage and speed.
   */
  updateProgress(bytesUploaded: number, bytesTotal: number): ProgressSnapshot {
    const percentage = bytesTotal > 0 ? Number(((bytesUploaded / bytesTotal) * 100).toFixed(2)) : 0;

    let bytesPerSecond = this.lastSpeed;

    if (this.trackSpeed) {
      const now = Date.now();

      if (this.lastProgressUpdate) {
        const timeDiff = (now - this.lastProgressUpdate.timestamp) / 1000;
        const bytesDiff = bytesUploaded - this.lastProgressUpdate.bytesUploaded;

        // Only recompute speed once enough time has elapsed for a meaningful
        // sample. Between samples we hold the last computed value rather than
        // snapping to 0, so the reported speed doesn't flicker.
        if (timeDiff > 1 && bytesDiff > 0) {
          bytesPerSecond = Math.round(bytesDiff / timeDiff);
          this.lastSpeed = bytesPerSecond;
          this.lastProgressUpdate = { bytesUploaded, timestamp: now };
        }
      }
    }

    return {
      bytesUploaded,
      bytesTotal,
      percentage,
      bytesPerSecond,
    };
  }

  /**
   * Reset tracking (e.g., on pause/cancel).
   */
  reset(): void {
    this.lastProgressUpdate = undefined;
    this.lastSpeed = 0;
  }
}
