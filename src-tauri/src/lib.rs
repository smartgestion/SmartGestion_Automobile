mod db;
mod machine;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Logger (debug builds only) -----------------------------------
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Local SQLite database ---------------------------------------
            // Creates / opens %LOCALAPPDATA%/<bundle>/paragestion.db and
            // applies the schema migrations.
            let db_state = db::init(&app.handle()).map_err(|e| {
                log::error!("Database initialization failed: {e}");
                Box::<dyn std::error::Error>::from(e.to_string())
            })?;

            log::info!("SQLite ready at {}", db_state.path.display());
            app.manage(db_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Generic SQL bridge (Task 2)
            db::commands::execute_query,
            db::commands::fetch_rows,
            db::commands::db_path,
            db::commands::db_schema_version,
            // Local authentication (Task 4A)
            db::commands::register_local_user,
            db::commands::verify_local_user,
            db::commands::has_local_users,
            // Device fingerprint (Task 7A)
            machine::get_machine_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
