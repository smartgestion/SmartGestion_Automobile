//! Local SQLite database manager for ParaGestion.
//!
//! The database file lives in the per-user local app-data directory
//! (e.g. on Windows: `%LOCALAPPDATA%\com.paragestion.desktop\paragestion.db`).
//! It is created automatically on first launch and migrated to the current
//! schema version. The single shared connection is wrapped in a
//! `parking_lot::Mutex` and registered as Tauri state so IPC commands can
//! safely acquire it.

pub mod auth;
pub mod commands;
pub mod schema;

use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};
use thiserror::Error;

/// Errors that can cross the IPC boundary.
#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[allow(dead_code)] // reserved for future use (lazy init / re-open paths)
    #[error("database not initialized")]
    NotInitialized,

    #[error("{0}")]
    Other(String),
}

/// Convert to a string for serde (Tauri commands need `Serialize` errors).
impl serde::Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type DbResult<T> = Result<T, DbError>;

/// Tauri-managed state holding the shared SQLite connection.
pub struct DbState {
    pub conn: Mutex<Connection>,
    pub path: PathBuf,
}

impl DbState {
    pub fn new(conn: Connection, path: PathBuf) -> Self {
        Self {
            conn: Mutex::new(conn),
            path,
        }
    }
}

/// Resolve the on-disk path for the SQLite file.
///
/// Uses Tauri's `path().app_local_data_dir()` which on Windows resolves to
/// `%LOCALAPPDATA%\<bundle identifier>\`.
fn resolve_db_path(app: &AppHandle) -> DbResult<PathBuf> {
    let mut dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| DbError::Other(format!("failed to resolve app local data dir: {e}")))?;

    // Make sure the directory exists.
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }

    dir.push("paragestion.db");
    Ok(dir)
}

/// Open (or create) the SQLite file at `path` and apply pragmas + migrations.
fn open_and_migrate(path: &Path) -> DbResult<Connection> {
    let existed = path.exists();
    let conn = Connection::open(path)?;

    // Recommended pragmas for desktop apps:
    //  - foreign_keys = ON     (enforce FK constraints)
    //  - journal_mode = WAL    (concurrent reads, durable writes)
    //  - synchronous = NORMAL  (good durability/perf trade-off with WAL)
    //  - busy_timeout = 5s     (retry instead of immediate SQLITE_BUSY)
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;

    apply_migrations(&conn)?;

    if existed {
        log::info!("Opened existing SQLite database at {}", path.display());
    } else {
        log::info!("Created new SQLite database at {}", path.display());
    }

    Ok(conn)
}

/// Add `column` to `table` only when it isn't already present.
///
/// Uses `PRAGMA table_info` to check existence so it is safe to run on every
/// startup (SQLite has no `ADD COLUMN IF NOT EXISTS`).
fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    decl: &str,
) -> DbResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({});", table))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .any(|name| name == column);

    if !exists {
        conn.execute_batch(&format!(
            "ALTER TABLE {} ADD COLUMN {} {};",
            table, column, decl
        ))?;
    }
    Ok(())
}

/// Apply migrations idempotently inside a single transaction.
fn apply_migrations(conn: &Connection) -> DbResult<()> {
    let tx_sql = "BEGIN IMMEDIATE;";
    conn.execute_batch(tx_sql)?;

    let result: DbResult<()> = (|| {
        for stmt in schema::MIGRATIONS {
            conn.execute_batch(stmt)?;
        }

        // Idempotently add columns introduced after the initial schema to
        // databases that already exist (CREATE TABLE IF NOT EXISTS won't add
        // them). SQLite errors if the column already exists, so guard each one.
        add_column_if_missing(conn, "factures", "voiture", "TEXT")?;
        add_column_if_missing(conn, "factures", "matricule", "TEXT")?;
        add_column_if_missing(conn, "devis", "voiture", "TEXT")?;
        add_column_if_missing(conn, "devis", "matricule", "TEXT")?;
        add_column_if_missing(conn, "avoirs", "voiture", "TEXT")?;
        add_column_if_missing(conn, "avoirs", "matricule", "TEXT")?;
        add_column_if_missing(conn, "bons_livraison_client", "voiture", "TEXT")?;
        add_column_if_missing(conn, "bons_livraison_client", "matricule", "TEXT")?;

        // Record the version (idempotent thanks to INSERT OR IGNORE).
        conn.execute(
            "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?1);",
            [schema::SCHEMA_VERSION],
        )?;
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")?;
            log::info!("Database schema is at version {}", schema::SCHEMA_VERSION);
            Ok(())
        }
        Err(e) => {
            // Best-effort rollback; ignore secondary errors.
            let _ = conn.execute_batch("ROLLBACK;");
            Err(e)
        }
    }
}

/// Public entry point used by `lib.rs::setup`.
///
/// Resolves the DB path, ensures the file/folder exist, opens it, applies
/// migrations and returns a `DbState` ready to be registered as Tauri state.
pub fn init(app: &AppHandle) -> DbResult<DbState> {
    let path = resolve_db_path(app)?;
    let conn = open_and_migrate(&path)?;
    Ok(DbState::new(conn, path))
}
