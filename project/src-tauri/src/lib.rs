use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Check for updates on startup (non-blocking)
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_update(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LICIN application");
}

async fn check_update(app: tauri::AppHandle) {
    let updater = app.updater();
    match updater.check().await {
        Ok(Some(update)) => {
            // Update found — dialog shown automatically by the updater plugin
            println!("Update available: {}", update.version);
        }
        Ok(None) => {
            println!("Already up to date");
        }
        Err(e) => {
            eprintln!("Update check failed: {}", e);
        }
    }
}
