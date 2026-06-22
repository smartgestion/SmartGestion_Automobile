//! Cryptographic helpers for the local `users` table.
//!
//! The Rust core is the **only** layer that ever sees plaintext passwords
//! and the only layer that ever performs hashing or verification. The
//! frontend exchanges `(email, password)` strings with the Rust side and
//! receives back a sanitized user object that never contains the
//! `password_hash`.
//!
//! Hashing algorithm: **bcrypt** at cost 12.
//!   * Self-contained PHC string ("$2b$12$<22-byte salt><31-byte hash>")
//!     stores algorithm marker + cost + salt + digest in one TEXT column.
//!   * ~250 ms / hash on a modern laptop — slow enough to deter offline
//!     brute force, fast enough for interactive sign-in.
//!   * OWASP 2024 recommended baseline.

use bcrypt::{hash, verify, DEFAULT_COST};

use super::{DbError, DbResult};

/// Cost factor used for every newly hashed password.
///
/// bcrypt's `DEFAULT_COST` is 12; pinning the constant locally guarantees
/// we don't accidentally lower it via a dependency bump.
pub const BCRYPT_COST: u32 = DEFAULT_COST;

/// Generate a bcrypt-encoded hash for `password`.
///
/// Returns the full PHC string (algorithm + cost + salt + digest) suitable
/// for direct storage in the `users.password_hash` TEXT column.
pub fn hash_password(password: &str) -> DbResult<String> {
    hash(password, BCRYPT_COST).map_err(|e| DbError::Other(format!("hash error: {e}")))
}

/// Constant-time comparison of `password` against a previously stored hash.
///
/// `verify` performs the constant-time digest check internally so we do
/// not need an additional timing-safe equality routine.
pub fn verify_password(password: &str, stored_hash: &str) -> DbResult<bool> {
    verify(password, stored_hash).map_err(|e| DbError::Other(format!("verify error: {e}")))
}

/// Normalise an email for storage and lookup: trim + lowercase.
///
/// Performed in one place so `register_local_user` and `verify_local_user`
/// can never disagree on which key to compare.
pub fn normalize_email(email: &str) -> String {
    email.trim().to_ascii_lowercase()
}

/// Cheap, defensive validation that we can run before reaching SQLite.
pub fn validate_email_password(email: &str, password: &str) -> DbResult<()> {
    let trimmed = email.trim();
    if trimmed.is_empty() {
        return Err(DbError::Other("email is required".into()));
    }
    if !trimmed.contains('@') {
        return Err(DbError::Other("invalid email".into()));
    }
    if password.is_empty() {
        return Err(DbError::Other("password is required".into()));
    }
    // bcrypt has a hard 72-byte input limit; reject earlier so the user
    // gets a clear error instead of silent truncation.
    if password.len() > 72 {
        return Err(DbError::Other(
            "password is too long (max 72 bytes for bcrypt)".into(),
        ));
    }
    Ok(())
}
