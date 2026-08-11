import { describe, it, expect } from 'vitest';
import { UploadQueue } from '../src/core/UploadQueue';
import {
  ControllableDriver,
  InMemoryStore,
  makeShaHasher,
  makeUploadFile,
  mockHandle,
  shaHex,
  tick,
} from './helpers';

// The real UploadController runs (default factory) so the integrity stage fires;
// a deterministic SHA-256 hasher is injected so no worker/wasm is needed.
const integrity = () => ({ algorithm: 'sha-256' as const, hasher: makeShaHasher() });

describe('UploadQueue integrity: dedup on start', () => {
  it('skips a second file whose content matches an already-completed upload', async () => {
    const driver = new ControllableDriver();
    const queue = new UploadQueue({
      driver,
      store: new InMemoryStore(),
      autoStart: true,
      integrity: integrity(),
    });
    await queue.ready;

    const completes: Array<[string, string]> = [];
    queue.on('complete', (id, url) => completes.push([id, url]));

    await queue.addFiles([makeUploadFile({ id: 'a', file: new File(['same-bytes'], 'a.bin') })]);
    await tick();
    await tick();
    expect(driver.sessions).toHaveLength(1);

    driver.sessions[0].succeed('https://done/a');
    await tick();

    await queue.addFiles([makeUploadFile({ id: 'b', file: new File(['same-bytes'], 'b.bin') })]);
    await tick();
    await tick();

    // B was a duplicate: no new transfer, completed with A's URL.
    expect(driver.sessions).toHaveLength(1);
    expect(completes).toContainEqual(['a', 'https://done/a']);
    expect(completes).toContainEqual(['b', 'https://done/a']);
  });
});

describe('UploadQueue integrity: resume verification', () => {
  it('drops a restored record whose content no longer matches the stored digest', async () => {
    const store = new InMemoryStore();
    const file = new File(['payload'], 'p.bin');
    store.records.set('p1', {
      id: 'p1',
      name: 'p.bin',
      size: file.size,
      type: '',
      handle: mockHandle(file),
      lastModified: file.lastModified,
      hash: { algorithm: 'sha-256', hex: '0'.repeat(64) }, // stale digest
    });
    store.files.set('p1', file);

    const queue = new UploadQueue({ driver: new ControllableDriver(), store, integrity: integrity() });
    await queue.ready;

    await queue.restoreUnfinishedUpload('p1');

    expect(store.records.has('p1')).toBe(false);
    expect(queue.getUploadState('p1')).toBeNull();
  });

  it('restores a record whose digest still matches', async () => {
    const store = new InMemoryStore();
    const content = 'payload';
    const file = new File([content], 'p.bin');
    store.records.set('p1', {
      id: 'p1',
      name: 'p.bin',
      size: file.size,
      type: '',
      handle: mockHandle(file),
      lastModified: file.lastModified,
      hash: { algorithm: 'sha-256', hex: shaHex(content) },
    });
    store.files.set('p1', file);

    const queue = new UploadQueue({ driver: new ControllableDriver(), store, integrity: integrity() });
    await queue.ready;

    await queue.restoreUnfinishedUpload('p1');

    expect(store.records.has('p1')).toBe(true);
    expect(queue.getUploadState('p1')).not.toBeNull();
  });
});

describe('UploadQueue integrity: persistence', () => {
  it('persists the digest alongside resume progress', async () => {
    const store = new InMemoryStore();
    const driver = new ControllableDriver();
    const file = new File(['payload'], 'p.bin');
    const queue = new UploadQueue({
      driver,
      store,
      autoStart: true,
      integrity: integrity(),
    });
    await queue.ready;

    await queue.addFiles([makeUploadFile({ id: 'p1', fileHandle: mockHandle(file), file })]);
    await tick();
    await tick();
    expect(driver.sessions).toHaveLength(1);

    driver.sessions[0].progress(3);
    await queue.pauseUpload('p1');
    await tick();

    expect(store.records.get('p1')?.hash?.hex).toBe(shaHex('payload'));
  });
});
