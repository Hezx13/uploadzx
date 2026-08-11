// Stable shim over the wasm-pack output. The real bindings + `.wasm` live in the
// gitignored `pkg/` folder and are produced by `pnpm build:wasm`. The worker
// imports this module so the generated artifacts can be regenerated without
// changing any tracked import paths. Types come from the sibling
// `uploadzx_hash.d.ts`.
export { default } from './pkg/uploadzx_hash.js';
export * from './pkg/uploadzx_hash.js';
