import { describe, it, expect, vi } from 'vitest';
import { UploadController } from '../src/transport/UploadController';
import {
  IntegrityCoordinator,
  resolveIntegrityOptions,
} from '../src/integrity/IntegrityCoordinator';
import type { IntegrityHasher, HashFileOptions } from '../src/integrity/IntegrityHasher';
import type { IntegrityDigest, UploadFile } from '../src/types';
import {
  ControllableDriver,
  ControllableHasher,
  makeShaHasher,
  shaHex,
} from './helpers';

const flush = () => new Promise<void>(r => setTimeout(r, 0));

function makeFile(content = 'payload', id = 'id-1'): UploadFile {
  const file = new File([content], 'f.bin', { type: 'application/octet-stream' });
  return { id, file, name: 'f.bin', size: file.size, type: file.type };
}

function makeCoordinator(hasher: IntegrityHasher, overrides = {}) {
  return new IntegrityCoordinator(hasher, resolveIntegrityOptions({ algorithm: 'sha-256', ...overrides }));
}

describe('resolveIntegrityOptions', () => {
  it('fills sensible defaults', () => {
    const resolved = resolveIntegrityOptions({});
    expect(resolved).toMatchObject({
      algorithm: 'blake3',
      verifyResume: true,
      sendToServer: true,
      metadataKey: 'checksum',
      dedup: true,
    });
    expect(resolved.chunkSize).toBeGreaterThan(0);
  });
});

describe('IntegrityCoordinator', () => {
  it('computes a digest once and caches it by file id', async () => {
    const spy = vi.fn(makeShaHasher().hashFile);
    const coordinator = makeCoordinator({ hashFile: spy });
    const file = makeFile('abc');

    const a = await coordinator.getDigest('id-1', file.file);
    const b = await coordinator.getDigest('id-1', file.file);

    expect(a.hex).toBe(shaHex('abc'));
    expect(b).toEqual(a);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(coordinator.getCached('id-1')).toEqual(a);
  });

  it('dedupes concurrent in-flight requests for the same id', async () => {
    const hasher = new ControllableHasher();
    const coordinator = makeCoordinator(hasher);
    const file = makeFile();

    const p1 = coordinator.getDigest('id-1', file.file);
    const p2 = coordinator.getDigest('id-1', file.file);
    hasher.resolveAll('abcd', 'sha-256');

    expect(await p1).toEqual(await p2);
    expect(hasher.calls).toBe(1);
  });

  it('tracks completed digests for dedup probes', () => {
    const coordinator = makeCoordinator(makeShaHasher());
    const digest: IntegrityDigest = { algorithm: 'sha-256', hex: 'ff' };
    coordinator.markCompleted(digest, 'id-1', 'https://done/1');
    expect(coordinator.findCompleted('ff')).toEqual({ fileId: 'id-1', url: 'https://done/1' });
    expect(coordinator.findCompleted('00')).toBeUndefined();
  });
});

describe('UploadController integrity stage', () => {
  it('hashes before creating the session and forwards the digest as driver metadata', async () => {
    const driver = new ControllableDriver();
    const coordinator = makeCoordinator(makeShaHasher());
    const onHash = vi.fn();
    const ctrl = new UploadController(makeFile('hello'), {}, driver, { onHash }, {
      integrity: { coordinator },
    });

    void ctrl.start();
    await flush();

    expect(driver.sessions).toHaveLength(1);
    expect(driver.lastCtx?.integrity).toEqual({
      digest: { algorithm: 'sha-256', hex: shaHex('hello') },
      metadataKey: 'checksum',
    });
    expect(onHash).toHaveBeenCalledWith('id-1', { algorithm: 'sha-256', hex: shaHex('hello') });
    expect(ctrl.getState().integrity?.hex).toBe(shaHex('hello'));
    expect(ctrl.getIntegrity?.()?.hex).toBe(shaHex('hello'));
  });

  it('omits server metadata when sendToServer is false', async () => {
    const driver = new ControllableDriver();
    const coordinator = makeCoordinator(makeShaHasher(), { sendToServer: false });
    const ctrl = new UploadController(makeFile(), {}, driver, {}, { integrity: { coordinator } });

    void ctrl.start();
    await flush();

    expect(driver.sessions).toHaveLength(1);
    expect(driver.lastCtx?.integrity).toBeUndefined();
  });

  it('skips the upload entirely when the digest is a known duplicate', async () => {
    const driver = new ControllableDriver();
    const coordinator = makeCoordinator(makeShaHasher());
    const file = makeFile('dup');
    // Pre-register the same content as already completed elsewhere.
    coordinator.markCompleted(
      { algorithm: 'sha-256', hex: shaHex('dup') },
      'other',
      'https://done/other'
    );

    const onComplete = vi.fn();
    const ctrl = new UploadController(file, {}, driver, { onComplete }, { integrity: { coordinator } });

    void ctrl.start();
    await flush();

    expect(driver.sessions).toHaveLength(0); // no transfer started
    expect(ctrl.getState().status).toBe('completed');
    expect(onComplete).toHaveBeenCalledWith('id-1', 'https://done/other');
  });

  it('treats a pause during hashing as a pause, not an error', async () => {
    const driver = new ControllableDriver();
    const hasher = new ControllableHasher();
    const coordinator = makeCoordinator(hasher);
    const onError = vi.fn();
    const ctrl = new UploadController(makeFile(), {}, driver, { onError }, { integrity: { coordinator } });

    void ctrl.start();
    await flush();
    // Hashing is in-flight (never resolved); pause aborts it.
    await ctrl.pause();
    await flush();

    expect(onError).not.toHaveBeenCalled();
    expect(driver.sessions).toHaveLength(0);
    expect(ctrl.getState().status).toBe('paused');
  });
});
