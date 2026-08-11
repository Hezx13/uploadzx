/**
 * Gated end-to-end smoke test for the real Rust/wasm hasher. Run after building
 * the wasm:
 *
 *   pnpm build:wasm && pnpm test:wasm:smoke
 *
 * It drives the compiled `Hasher` through the same chunked `update()` loop the
 * worker uses, exercising the wasm boundary + incremental streaming against a
 * Node SHA-256 oracle and BLAKE3 known-answer vectors. Kept out of the default
 * vitest run (which uses an injected JS hasher and needs no wasm).
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const jsUrl = new URL('../src/integrity/wasm/pkg/uploadzx_hash.js', import.meta.url);
const binPath = fileURLToPath(new URL('../src/integrity/wasm/pkg/uploadzx_hash_bg.wasm', import.meta.url));

if (!existsSync(binPath)) {
  console.error('wasm not built. Run `pnpm build:wasm` first.');
  process.exit(1);
}

const mod = await import(jsUrl.href);
await mod.default(readFileSync(binPath));

const blob = new Blob(['the quick brown fox '.repeat(50_000)]);

async function streamHash(algorithm) {
  const hasher = new mod.Hasher(algorithm);
  const chunk = 64 * 1024;
  let offset = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + chunk, blob.size);
    hasher.update(new Uint8Array(await blob.slice(offset, end).arrayBuffer()));
    offset = end;
  }
  return hasher.finalize();
}

let ok = true;
function check(name, got, expected) {
  const pass = expected instanceof RegExp ? expected.test(got) : got === expected;
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} -> ${got}`);
}

const expectedSha = createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
check('streamed sha-256 matches node oracle', await streamHash('sha-256'), expectedSha);
check('streamed blake3 is 64 hex chars', await streamHash('blake3'), /^[0-9a-f]{64}$/);

// Known-answer vectors (must match crates/uploadzx-hash cargo tests).
const abc = new Blob(['abc']);
async function hashBlob(algorithm, b) {
  const h = new mod.Hasher(algorithm);
  h.update(new Uint8Array(await b.arrayBuffer()));
  return h.finalize();
}
check(
  'sha-256("abc")',
  await hashBlob('sha-256', abc),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
);
check(
  'blake3("abc")',
  await hashBlob('blake3', abc),
  '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85'
);

console.log(ok ? '\nALL OK' : '\nFAILURES');
process.exit(ok ? 0 : 1);
