//! Hardware fingerprint helper (Task 7A).
//!
//! Reads the OS-assigned machine identifier and returns a SHA-256
//! lowercase-hex digest of it. The raw OS identifier never crosses the
//! IPC boundary, so neither the frontend nor any value persisted to the
//! cloud ever sees the actual `HKLM\...\MachineGuid` /
//! `IOPlatformUUID` / `/etc/machine-id`. Hashing is deterministic, so
//! the resulting fingerprint is:
//!
//!   * stable across reboots on the same machine,
//!   * different on a different physical (or virtual) machine,
//!   * opaque to anyone who sees the value.
//!
//! Platform behaviour (delegated to the `machine-uid` crate):
//!
//!   * Windows  →  HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography
//!                 \MachineGuid    (set once at OS install).
//!   * macOS    →  IOPlatformUUID via IOKit.
//!   * Linux    →  /etc/machine-id, falling back to
//!                 /var/lib/dbus/machine-id.

use sha2::{Digest, Sha256};

/// Compute the device fingerprint.
///
/// The function is **infallible at the public boundary**: failures from
/// the underlying crate are surfaced as a `Result<String, String>` so
/// they round-trip cleanly through Tauri's IPC. The frontend is expected
/// to handle the `Err` case gracefully (e.g. fall back to a local-only
/// guard or refuse the device-binding step).
#[tauri::command]
pub fn get_machine_id() -> Result<String, String> {
    // `machine_uid::get` reads the OS-assigned identifier. Wrapped errors
    // (e.g. registry access denied on Windows) are turned into strings
    // so they serialise across the IPC boundary.
    let raw = machine_uid::get().map_err(|e| format!("failed to read machine id: {e}"))?;

    if raw.trim().is_empty() {
        return Err("empty machine id returned by OS".into());
    }

    // Hash the raw identifier so it never leaves the Rust process.
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();

    // Lowercase hex — stable, opaque, comparable as a plain string.
    let hex: String = digest.iter().map(|b| format!("{:02x}", b)).collect();

    log::info!(
        "Resolved device fingerprint (first 12 chars): {}…",
        &hex[..12]
    );

    Ok(hex)
}
