import { describe, it, expect, vi } from 'vitest';
import { UploadStateMachine } from '../src/transport/UploadStateMachine';
import type { UploadState } from '../src/types';

function baseState(): UploadState {
  const file = new File(['x'], 'f.bin', { type: 'application/octet-stream' });
  return {
    fileId: 'id-1',
    status: 'pending',
    file,
    progress: {
      fileId: 'id-1',
      bytesUploaded: 0,
      bytesTotal: file.size,
      percentage: 0,
      bytesPerSecond: 0,
    },
  };
}

describe('UploadStateMachine', () => {
  it('permits legal transitions and notifies', () => {
    const onChange = vi.fn();
    const m = new UploadStateMachine(baseState(), onChange);

    expect(m.transition('uploading')).toBe(true);
    expect(m.status).toBe('uploading');
    expect(m.transition('completed', { url: 'https://x' })).toBe(true);
    expect(m.getState().url).toBe('https://x');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('rejects illegal transitions without mutating or notifying', () => {
    const onChange = vi.fn();
    const m = new UploadStateMachine(baseState(), onChange);
    m.transition('uploading');
    m.transition('paused');
    onChange.mockClear();

    // paused -> error is illegal (an abort after an intentional pause).
    expect(m.transition('error', { error: new Error('boom') })).toBe(false);
    expect(m.status).toBe('paused');
    expect(m.getState().error).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats completed and cancelled as terminal (except completed->cancelled)', () => {
    const m = new UploadStateMachine(baseState(), vi.fn());
    m.transition('uploading');
    m.transition('completed');
    expect(m.transition('uploading')).toBe(false);
    expect(m.transition('cancelled')).toBe(true); // cancelling a finished upload is allowed
    expect(m.transition('uploading')).toBe(false); // cancelled is terminal
  });

  it('does not notify on hydrate', () => {
    const onChange = vi.fn();
    const m = new UploadStateMachine(baseState(), onChange);
    m.hydrate({ ...baseState(), status: 'paused' });
    expect(m.status).toBe('paused');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits progress only when asked', () => {
    const onChange = vi.fn();
    const m = new UploadStateMachine(baseState(), onChange);
    const progress = { ...baseState().progress, bytesUploaded: 5 };

    m.setProgress(progress, false);
    expect(onChange).not.toHaveBeenCalled();
    expect(m.getState().progress.bytesUploaded).toBe(5);

    m.setProgress({ ...progress, bytesUploaded: 9 }, true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
