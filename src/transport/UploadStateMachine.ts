import type { UploadProgress, UploadState, UploadStatus } from '../types';

/**
 * The legal status transitions for a single upload. Anything not listed is
 * rejected, which is what lets the controller treat, e.g., an abort-driven
 * rejection that arrives *after* a pause as a no-op rather than a spurious error.
 */
const TRANSITIONS: Record<UploadStatus, readonly UploadStatus[]> = {
  pending: ['uploading', 'cancelled'],
  uploading: ['paused', 'completed', 'error', 'cancelled'],
  paused: ['uploading', 'cancelled'],
  error: ['uploading', 'cancelled'],
  completed: ['cancelled'],
  cancelled: [],
};

/**
 * Owns the upload's status and {@link UploadState}, enforces legal transitions,
 * and notifies a single sink when the state changes. This is the "state" half of
 * what used to live inside UploadController, extracted so the controller can
 * coordinate rather than also be the state machine.
 */
export class UploadStateMachine {
  private state: UploadState;

  constructor(
    initial: UploadState,
    private readonly onChange: (state: UploadState) => void
  ) {
    this.state = initial;
  }

  get status(): UploadStatus {
    return this.state.status;
  }

  /** Returns a defensive copy so callers can't mutate internal state. */
  getState(): UploadState {
    return { ...this.state };
  }

  canTransitionTo(next: UploadStatus): boolean {
    return TRANSITIONS[this.state.status].includes(next);
  }

  /**
   * Replace the entire state without a transition check and without notifying.
   * Used only to hydrate from persisted resume data before the upload starts;
   * not a runtime transition, so no listener should react to it yet.
   */
  hydrate(state: UploadState): void {
    this.state = state;
  }

  /**
   * Attempt a guarded status transition, optionally patching extra fields
   * (url/error/progress). Returns `false` (and does nothing) if the transition
   * is illegal from the current status.
   */
  transition(next: UploadStatus, patch: Partial<UploadState> = {}): boolean {
    if (!this.canTransitionTo(next)) {
      return false;
    }
    this.state = { ...this.state, ...patch, status: next };
    this.onChange(this.getState());
    return true;
  }

  /**
   * Update progress without a status change. `emit` controls whether listeners
   * are notified, so the controller can keep internal state current while
   * coalescing outward notifications.
   */
  setProgress(progress: UploadProgress, emit: boolean): void {
    this.state = { ...this.state, progress };
    if (emit) {
      this.onChange(this.getState());
    }
  }
}
