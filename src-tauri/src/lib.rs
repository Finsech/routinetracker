mod autostart;
mod browser_bridge;
mod database;
mod messages;
mod ollama;
mod tracker;

use browser_bridge::BrowserBridge;
use database::Database;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};
use tracker::Tracker;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_SHOW_ID: &str = "tray_show";
const TRAY_QUIT_ID: &str = "tray_quit";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn stop_background_services<R: Runtime, M: Manager<R>>(manager: &M) {
    let browser_bridge = manager.state::<BrowserBridge>();
    if let Err(error) = browser_bridge.stop() {
        eprintln!("Failed to stop browser bridge on exit: {error}");
    }

    let tracker = manager.state::<Tracker>();
    if let Err(error) = tracker.stop() {
        eprintln!("Failed to stop tracker on exit: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show_item =
                MenuItem::with_id(app, TRAY_SHOW_ID, "Открыть FocusFlow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, TRAY_QUIT_ID, "Выход", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("main")
                .menu(&tray_menu)
                .tooltip("FocusFlow")
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => show_main_window(tray.app_handle()),
                    _ => {}
                })
                .build(app)?;

            let database = Database::open(app.handle())?;
            let browser_bridge = BrowserBridge::default();
            if let Err(error) = browser_bridge.start() {
                eprintln!("Failed to start browser bridge: {error}");
            }

            app.manage(database);
            app.manage(browser_bridge);
            app.manage(Tracker::default());
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().0.as_str() {
            TRAY_SHOW_ID => show_main_window(app),
            TRAY_QUIT_ID => {
                stop_background_services(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            autostart::get_autostart_status,
            autostart::set_autostart_status,
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
            database::export_focusflow_data,
            ollama::request_ollama_generate,
            tracker::start_tracking,
            tracker::stop_tracking,
            tracker::get_tracking_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
