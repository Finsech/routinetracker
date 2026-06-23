mod browser_bridge;
mod database;
mod tracker;

use browser_bridge::BrowserBridge;
use database::Database;
use tauri::Manager;
use tracker::Tracker;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let database = Database::open(app.handle())?;
            let browser_bridge = BrowserBridge::default();
            if let Err(error) = browser_bridge.start() {
                eprintln!("Не удалось запустить browser bridge: {error}");
            }
            app.manage(database);
            app.manage(browser_bridge);
            app.manage(Tracker::default());
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let browser_bridge = window.state::<BrowserBridge>();
                if let Err(error) = browser_bridge.stop() {
                    eprintln!("Не удалось остановить browser bridge при закрытии окна: {error}");
                }
                let tracker = window.state::<Tracker>();
                if let Err(error) = tracker.stop() {
                    eprintln!("Не удалось остановить tracker при закрытии окна: {error}");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            browser_bridge::get_browser_bridge_status,
            database::get_activity_logs,
            database::create_activity_log,
            database::get_idle_logs,
            database::create_idle_log,
            database::update_idle_log,
            database::get_settings,
            database::set_setting,
            database::get_stoplist,
            database::add_stoplist_item,
            database::remove_stoplist_item,
            database::get_llm_summary,
            database::save_llm_summary,
            database::get_llm_summaries,
            tracker::start_tracking,
            tracker::stop_tracking,
            tracker::get_tracking_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
