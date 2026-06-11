---
title: Contributing
description: Local setup, tooling, and good first contributions.
---

Contributions are welcome. The codebase is small, typed, and tested. Here's how
to get productive quickly.

## Local setup

```bash
pnpm install        # install deps
pnpm build          # bundle the core with tsup (ESM + CJS + d.ts)
pnpm dev            # rebuild on change (tsup --watch)
pnpm test           # run Vitest (uses fake-indexeddb + happy-dom)
pnpm test:watch     # watch mode
pnpm format         # prettier --write ./src
```

### Building the integrity (wasm) feature

The optional integrity hasher is a Rust crate (`crates/uploadzx-hash`) compiled to
WebAssembly. Only contributors touching that feature need the Rust toolchain.

```bash
# one-time: install Rust + the wasm target + wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

pnpm test:wasm        # cargo tests (known-answer vectors) for the crate
pnpm build:wasm       # wasm-pack → src/integrity/wasm/pkg (gitignored)
pnpm build:integrity  # build:wasm + bundle the worker/entry to dist/integrity
pnpm build:all        # core + integrity (used by prepublishOnly)
pnpm test:wasm:smoke  # gated end-to-end smoke against the real wasm
```

The default `pnpm test` uses an injected JS hasher and needs no wasm. The published
package ships the prebuilt wasm, so consumers never need Rust.

## Run the examples against your local build

```bash
pnpm examples:install   # install example deps + build the library
pnpm example:react      # React + Vite demo
pnpm example:vanilla    # Vanilla + Vite demo
```

## Tooling

| Concern             | Tool                                              |
| ------------------- | ------------------------------------------------- |
| Language            | TypeScript (ES2020+, strict)                      |
| Bundler             | tsup                                              |
| Tests               | Vitest + `fake-indexeddb` + `happy-dom`           |
| Formatting          | Prettier                                          |
| Resumable transport | `tus-js-client`                                   |
| Integrity hashing   | Rust + `wasm-pack` (`crates/uploadzx-hash`)       |

## Good first contributions

- **A new driver** (S3 multipart, Azure Blob): implement `UploadDriver` — see
  [Writing a driver](/docs/core/custom-driver). The queue/React layers need no
  changes.
- **A persistence adapter** for a new backend: implement `PersistenceAdapter`.
- **Tests** for edge cases (resume after change, quota failures, SSR init).
- **Docs** improvements (this site lives under `docs/`).

> [!NOTE] **Architecture invariants to preserve:** the core stays UI-agnostic; a
> session reports failure by rejecting (no `onError`); events are the single
> source of truth for derived state; nothing should write to the console by
> default.
