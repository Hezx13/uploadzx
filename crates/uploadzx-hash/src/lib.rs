//! Streaming integrity hasher for uploadzx, compiled to WebAssembly.
//!
//! Exposes a single `Hasher` type that supports incremental hashing: it is fed
//! file slices one chunk at a time via [`Hasher::update`] and produces a
//! lowercase-hex digest from [`Hasher::finalize`]. Incremental hashing is what
//! lets the browser hash arbitrarily large files in constant memory — unlike
//! `crypto.subtle.digest()`, which requires the whole buffer at once.
//!
//! Two algorithms are supported:
//!   - `"blake3"` — fast, SIMD/tree-hashed; the recommended default. Not
//!     available in WebCrypto, which is the main reason this crate exists.
//!   - `"sha-256"` — incremental SHA-256, for servers/pipelines that mandate it
//!     (e.g. S3 per-part checksums).

use sha2::{Digest as _, Sha256};
use wasm_bindgen::prelude::*;

/// The concrete hashing backend selected at construction time.
enum Backend {
    Blake3(Box<blake3::Hasher>),
    Sha256(Sha256),
}

/// Resolve an algorithm name to a backend. Kept separate from the wasm-bindgen
/// constructor so the parsing/validation can be unit-tested on a native target
/// (constructing a `JsError` is only valid when running as wasm).
fn make_backend(algorithm: &str) -> Result<Backend, String> {
    match algorithm.to_ascii_lowercase().as_str() {
        "blake3" => Ok(Backend::Blake3(Box::new(blake3::Hasher::new()))),
        "sha-256" | "sha256" => Ok(Backend::Sha256(Sha256::new())),
        other => Err(format!(
            "uploadzx-hash: unsupported algorithm '{other}' (expected 'blake3' or 'sha-256')"
        )),
    }
}

/// Incremental hasher exported to JavaScript via wasm-bindgen.
///
/// Lifecycle: `new(algorithm)` → `update(chunk)` (repeated) → `finalize()`.
/// `finalize` consumes the hasher, mirroring the Rust digest APIs and making it
/// impossible to keep feeding a finalized instance.
#[wasm_bindgen]
pub struct Hasher {
    backend: Backend,
}

#[wasm_bindgen]
impl Hasher {
    /// Create a hasher for the given algorithm (`"blake3"` or `"sha-256"`).
    ///
    /// Accepts a few common spellings (`"sha256"`, `"SHA-256"`) so the JS side
    /// can pass through user config without normalizing first. Returns an error
    /// for unknown algorithms rather than silently defaulting.
    #[wasm_bindgen(constructor)]
    pub fn new(algorithm: &str) -> Result<Hasher, JsError> {
        let backend = make_backend(algorithm).map_err(|e| JsError::new(&e))?;
        Ok(Hasher { backend })
    }

    /// Feed the next slice of the file into the running digest.
    ///
    /// The `&[u8]` is a view over JS-owned bytes that wasm-bindgen copies into
    /// linear memory once per call; callers should pass reasonably large chunks
    /// (e.g. several MiB) so the per-call boundary cost is amortized.
    pub fn update(&mut self, chunk: &[u8]) {
        match &mut self.backend {
            Backend::Blake3(h) => {
                h.update(chunk);
            }
            Backend::Sha256(h) => {
                h.update(chunk);
            }
        }
    }

    /// Consume the hasher and return the digest as lowercase hex.
    pub fn finalize(self) -> String {
        match self.backend {
            Backend::Blake3(h) => h.finalize().to_hex().to_string(),
            Backend::Sha256(h) => to_hex(&h.finalize()),
        }
    }
}

/// Lowercase-hex encode a byte slice without pulling in an extra dependency.
fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hash(algorithm: &str, chunks: &[&[u8]]) -> String {
        // Use the native-testable backend constructor directly; `Hasher::new`
        // routes through wasm-bindgen's `JsError`, which can't run off-wasm.
        let mut h = Hasher {
            backend: make_backend(algorithm).unwrap(),
        };
        for c in chunks {
            h.update(c);
        }
        h.finalize()
    }

    #[test]
    fn sha256_known_answers() {
        // NIST/standard vectors.
        assert_eq!(
            hash("sha-256", &[b""]),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hash("sha-256", &[b"abc"]),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn blake3_known_answers() {
        // Vectors from the BLAKE3 reference test suite.
        assert_eq!(
            hash("blake3", &[b""]),
            "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
        );
        assert_eq!(
            hash("blake3", &[b"abc"]),
            "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85"
        );
    }

    #[test]
    fn streaming_matches_single_shot() {
        // Feeding the same bytes in multiple chunks must equal one big update.
        let one = hash("blake3", &[b"hello world, this is uploadzx"]);
        let many = hash("blake3", &[b"hello ", b"world, ", b"this is ", b"uploadzx"]);
        assert_eq!(one, many);

        let one = hash("sha-256", &[b"hello world, this is uploadzx"]);
        let many = hash("sha-256", &[b"hello ", b"world, ", b"this is ", b"uploadzx"]);
        assert_eq!(one, many);
    }

    #[test]
    fn unknown_algorithm_errors() {
        assert!(make_backend("md5").is_err());
        assert!(make_backend("blake3").is_ok());
        assert!(make_backend("SHA256").is_ok());
    }
}
