use crate::database::{Database, NewActivityLog};
use chrono::Utc;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const IDLE_THRESHOLD: Duration = Duration::from_secs(10 * 60);

#[derive(Default)]
pub struct Tracker {
    running: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

#[derive(Debug, Clone, PartialEq)]
struct WindowSnapshot {
    app_name: String,
    window_title: Option<String>,
    url: Option<String>,
}

#[derive(Debug)]
struct ActiveSession {
    snapshot: WindowSnapshot,
    start_time: String,
}

#[derive(Debug, Serialize)]
pub struct TrackerStatus {
    pub running: bool,
}

impl Tracker {
    pub fn start(&self, app: AppHandle) -> Result<(), String> {
        let mut handle = self
            .handle
            .lock()
            .map_err(|_| "Не удалось получить доступ к tracker handle".to_string())?;

        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);

        *handle = Some(thread::spawn(move || {
            tracking_loop(app, running);
        }));

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.running.store(false, Ordering::SeqCst);

        let mut handle = self
            .handle
            .lock()
            .map_err(|_| "Не удалось получить доступ к tracker handle".to_string())?;

        if let Some(handle) = handle.take() {
            handle
                .join()
                .map_err(|_| "Фоновый tracker завершился с ошибкой".to_string())?;
        }

        Ok(())
    }

    pub fn status(&self) -> TrackerStatus {
        TrackerStatus {
            running: self.running.load(Ordering::SeqCst),
        }
    }
}

#[tauri::command]
pub fn start_tracking(app: AppHandle, tracker: tauri::State<Tracker>) -> Result<(), String> {
    tracker.start(app)
}

#[tauri::command]
pub fn stop_tracking(tracker: tauri::State<Tracker>) -> Result<(), String> {
    tracker.stop()
}

#[tauri::command]
pub fn get_tracking_status(tracker: tauri::State<Tracker>) -> TrackerStatus {
    tracker.status()
}

fn tracking_loop(app: AppHandle, running: Arc<AtomicBool>) {
    let mut current: Option<ActiveSession> = None;

    while running.load(Ordering::SeqCst) {
        if read_idle_duration() >= IDLE_THRESHOLD {
            close_session(&app, current.take());
            thread::sleep(POLL_INTERVAL);
            continue;
        }

        if let Some(snapshot) = read_active_window() {
            if current
                .as_ref()
                .map(|session| session.snapshot != snapshot)
                .unwrap_or(true)
            {
                close_session(&app, current.take());
                current = Some(ActiveSession {
                    snapshot,
                    start_time: now(),
                });
            }
        }

        thread::sleep(POLL_INTERVAL);
    }

    close_session(&app, current);
}

fn close_session(app: &AppHandle, session: Option<ActiveSession>) {
    let Some(session) = session else {
        return;
    };

    let database = app.state::<Database>();
    let result = database.insert_activity_log(NewActivityLog {
        start_time: session.start_time,
        end_time: now(),
        app_name: session.snapshot.app_name,
        window_title: session.snapshot.window_title,
        url: session.snapshot.url,
    });

    if let Err(error) = result {
        eprintln!("Не удалось сохранить активность: {error}");
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

#[cfg(target_os = "windows")]
fn read_idle_duration() -> Duration {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };

    let success = unsafe { GetLastInputInfo(&mut info).as_bool() };
    if !success {
        return Duration::ZERO;
    }

    let tick_count = unsafe { GetTickCount() };
    Duration::from_millis(tick_count.wrapping_sub(info.dwTime) as u64)
}

#[cfg(not(target_os = "windows"))]
fn read_idle_duration() -> Duration {
    Duration::ZERO
}

#[cfg(target_os = "windows")]
fn read_active_window() -> Option<WindowSnapshot> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
    };

    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return None;
    }

    let length = unsafe { GetWindowTextLengthW(hwnd) };
    let mut buffer = vec![0u16; length.saturating_add(1) as usize];
    let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
    let window_title = if copied > 0 {
        Some(String::from_utf16_lossy(&buffer[..copied as usize]))
    } else {
        None
    };

    Some(WindowSnapshot {
        app_name: read_process_name(hwnd).unwrap_or_else(|| "unknown.exe".to_string()),
        window_title,
        url: None,
    })
}

#[cfg(target_os = "windows")]
fn read_process_name(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use std::path::Path;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

    let mut process_id = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    }

    if process_id == 0 {
        return None;
    }

    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
        .ok()
        .filter(|handle| !handle.is_invalid())?;

    let mut buffer = vec![0u16; 260];
    let mut size = buffer.len() as u32;
    let success = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .is_ok()
    };
    unsafe {
        let _ = CloseHandle(process);
    }

    if !success || size == 0 {
        return None;
    }

    let path = String::from_utf16_lossy(&buffer[..size as usize]);
    Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
}

#[cfg(not(target_os = "windows"))]
fn read_active_window() -> Option<WindowSnapshot> {
    None
}
