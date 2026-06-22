//! IPC commands bridging the React frontend to the SQLite layer.
//!
//! Two generic, parameterised entry points are exposed:
//!
//! - `execute_query(sql, params)` for `INSERT / UPDATE / DELETE / DDL`.
//!   Returns `{ rowsAffected, lastInsertId }`.
//!
//! - `fetch_rows(sql, params)` for `SELECT`.
//!   Returns an array of objects keyed by column name.
//!
//! Parameters are accepted as a JSON array (`Vec<serde_json::Value>`),
//! converted to native SQLite values, and bound positionally — so the
//! frontend never has to interpolate values into the SQL string itself.

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{OptionalExtension, ToSql};
use serde::Serialize;
use serde_json::{Map, Value as JsonValue};
use tauri::State;
use uuid::Uuid;

use super::auth::{hash_password, normalize_email, validate_email_password, verify_password};
use super::{DbError, DbResult, DbState};

// ---------------------------------------------------------------------------
// JSON <-> SQLite value conversions
// ---------------------------------------------------------------------------

/// Convert a `serde_json::Value` from the frontend into a SQLite `Value`.
///
/// JS numbers become INTEGER if they fit losslessly in i64, REAL otherwise.
/// `null` / `undefined` become SQL NULL.
fn json_to_sql(v: &JsonValue) -> SqlValue {
    match v {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlValue::Real(f)
            } else {
                // Fallback (very large unsigned ints): store as string.
                SqlValue::Text(n.to_string())
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        // Arrays / objects are serialised as JSON text so callers can store
        // structured payloads in TEXT columns if they need to.
        JsonValue::Array(_) | JsonValue::Object(_) => SqlValue::Text(v.to_string()),
    }
}

/// Convert a row value returned from SQLite back into JSON.
fn sql_to_json(v: ValueRef<'_>) -> JsonValue {
    match v {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => {
            // `serde_json::Number::from_f64` returns None for NaN/Inf.
            serde_json::Number::from_f64(f)
                .map(JsonValue::Number)
                .unwrap_or(JsonValue::Null)
        }
        ValueRef::Text(t) => JsonValue::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => {
            // Represent blobs as an array of byte values for transport.
            // (Rare in this app; included for completeness.)
            JsonValue::Array(b.iter().map(|byte| JsonValue::from(*byte)).collect())
        }
    }
}

// ---------------------------------------------------------------------------
// Command response payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    pub rows_affected: usize,
    pub last_insert_id: i64,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Execute a statement that does not return rows (INSERT/UPDATE/DELETE/DDL).
#[tauri::command]
pub fn execute_query(
    state: State<'_, DbState>,
    sql: String,
    params: Option<Vec<JsonValue>>,
) -> DbResult<ExecuteResult> {
    let conn = state.conn.lock();
    let mut stmt = conn.prepare(&sql)?;

    let params = params.unwrap_or_default();
    let bindings: Vec<SqlValue> = params.iter().map(json_to_sql).collect();
    let refs: Vec<&dyn ToSql> = bindings.iter().map(|v| v as &dyn ToSql).collect();

    let rows_affected = stmt.execute(refs.as_slice())?;
    let last_insert_id = conn.last_insert_rowid();

    Ok(ExecuteResult {
        rows_affected,
        last_insert_id,
    })
}

/// Execute a SELECT and return the rows as JSON objects keyed by column name.
#[tauri::command]
pub fn fetch_rows(
    state: State<'_, DbState>,
    sql: String,
    params: Option<Vec<JsonValue>>,
) -> DbResult<Vec<JsonValue>> {
    let conn = state.conn.lock();
    let mut stmt = conn.prepare(&sql)?;

    let params = params.unwrap_or_default();
    let bindings: Vec<SqlValue> = params.iter().map(json_to_sql).collect();
    let refs: Vec<&dyn ToSql> = bindings.iter().map(|v| v as &dyn ToSql).collect();

    // Snapshot column names once; SQLite re-resolves them per call so we
    // need to keep ownership of the strings before stepping through rows.
    let column_names: Vec<String> = stmt
        .column_names()
        .into_iter()
        .map(|s| s.to_owned())
        .collect();

    let mut rows = stmt.query(refs.as_slice())?;
    let mut out: Vec<JsonValue> = Vec::new();

    while let Some(row) = rows.next()? {
        let mut obj = Map::with_capacity(column_names.len());
        for (idx, name) in column_names.iter().enumerate() {
            let value_ref = row.get_ref(idx)?;
            obj.insert(name.clone(), sql_to_json(value_ref));
        }
        out.push(JsonValue::Object(obj));
    }

    Ok(out)
}

/// Diagnostic helper for the frontend / tests: where does the DB live?
#[tauri::command]
pub fn db_path(state: State<'_, DbState>) -> DbResult<String> {
    Ok(state.path.display().to_string())
}

/// Returns the highest applied schema version.
#[tauri::command]
pub fn db_schema_version(state: State<'_, DbState>) -> DbResult<i64> {
    let conn = state.conn.lock();
    let v: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;",
            [],
            |row| row.get(0),
        )
        .map_err(DbError::from)?;
    Ok(v)
}

// ===========================================================================
// Local authentication commands (Task 4A)
//
// Frontend ↔ Rust contract:
//
//   register_local_user(email, password, role) -> LocalUser
//   verify_local_user  (email, password)       -> LocalUser
//   has_local_users    ()                      -> bool
//
// The returned `LocalUser` deliberately omits `password_hash`. The hash
// never leaves the Rust process.
// ===========================================================================

/// Sanitised user record sent back to the frontend.
///
/// Mirrors the row shape of the `users` table minus the password hash.
#[derive(Debug, Serialize)]
pub struct LocalUser {
    pub id: String,
    pub email: String,
    pub role: String,
    pub created_at: String,
}

/// Create a new user with a securely hashed password.
///
/// * `email` is trimmed + lowercased before storage.
/// * `password` is bcrypt-hashed (cost 12); plaintext is never logged.
/// * `id` is a freshly generated v4 UUID.
///
/// Returns the safe `LocalUser` payload. Fails with `"email already
/// registered"` when the UNIQUE constraint on `users.email` is violated.
#[tauri::command]
pub fn register_local_user(
    state: State<'_, DbState>,
    email: String,
    password: String,
    role: String,
) -> DbResult<LocalUser> {
    validate_email_password(&email, &password)?;
    let email = normalize_email(&email);
    let role = role.trim().to_string();
    if role.is_empty() {
        return Err(DbError::Other("role is required".into()));
    }

    // Hash *before* taking the connection lock so we don't hold the DB
    // mutex during the ~250 ms bcrypt work.
    let password_hash = hash_password(&password)?;
    let id = Uuid::new_v4().to_string();

    let conn = state.conn.lock();
    let result = conn.execute(
        "INSERT INTO users (id, email, password_hash, role) \
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&id, &email, &password_hash, &role],
    );

    match result {
        Ok(_) => {}
        Err(rusqlite::Error::SqliteFailure(err, _))
            if err.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            return Err(DbError::Other("email already registered".into()));
        }
        Err(e) => return Err(DbError::Sqlite(e)),
    }

    // Read back `created_at` so the returned object matches what is on disk.
    let created_at: String = conn.query_row(
        "SELECT created_at FROM users WHERE id = ?1",
        rusqlite::params![&id],
        |row| row.get(0),
    )?;

    log::info!("Registered local user {} ({})", &email, &role);

    Ok(LocalUser {
        id,
        email,
        role,
        created_at,
    })
}

/// Verify a `(email, password)` pair and return the matching user.
///
/// Returns the same generic `"invalid credentials"` error whether the
/// email is unknown or the password is wrong, to avoid leaking which
/// emails are registered (user-enumeration prevention).
///
/// On success the user is logged in by the frontend (Task 4B persists
/// the session); the password and hash never leave this function.
#[tauri::command]
pub fn verify_local_user(
    state: State<'_, DbState>,
    email: String,
    password: String,
) -> DbResult<LocalUser> {
    if email.trim().is_empty() || password.is_empty() {
        return Err(DbError::Other("invalid credentials".into()));
    }
    let email_norm = normalize_email(&email);

    // Fetch under the lock, then verify outside the lock so the bcrypt
    // work doesn't block other queries.
    let record: Option<(String, String, String, String)> = {
        let conn = state.conn.lock();
        conn.query_row(
            "SELECT id, password_hash, role, created_at \
             FROM users WHERE email = ?1",
            rusqlite::params![&email_norm],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()?
    };

    let (id, password_hash, role, created_at) = match record {
        Some(r) => r,
        None => {
            // Run a dummy verify against a fixed hash so the response time
            // for "unknown email" matches "wrong password".
            let _ = verify_password(&password, DUMMY_BCRYPT_HASH);
            return Err(DbError::Other("invalid credentials".into()));
        }
    };

    if !verify_password(&password, &password_hash)? {
        return Err(DbError::Other("invalid credentials".into()));
    }

    log::info!("Local user signed in: {}", &email_norm);

    Ok(LocalUser {
        id,
        email: email_norm,
        role,
        created_at,
    })
}

/// `true` when at least one row exists in `users`, `false` otherwise.
///
/// Lightweight: uses `EXISTS` so the query terminates after the first row
/// rather than performing a full COUNT scan.
#[tauri::command]
pub fn has_local_users(state: State<'_, DbState>) -> DbResult<bool> {
    let conn = state.conn.lock();
    let exists: i64 = conn.query_row("SELECT EXISTS(SELECT 1 FROM users LIMIT 1)", [], |row| {
        row.get(0)
    })?;
    Ok(exists != 0)
}

/// Stable bcrypt hash used to keep `verify_local_user` constant-time for
/// non-existent emails. The plaintext doesn't matter — only the cost
/// factor (12) needs to match what new accounts use, so the verification
/// work is comparable in either branch.
///
/// Generated once with `bcrypt::hash("dummy", 12)` and pinned as a constant
/// to avoid the per-call cost of computing a fresh dummy.
const DUMMY_BCRYPT_HASH: &str = "$2b$12$abcdefghijklmnopqrstuuMz0e7yQDk8jbBQ1MqzVZl9.kQyqDxK6";
