use crate::database::{Database, NewActivityLog};
use chrono::{Duration as ChronoDuration, Utc};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const IDLE_THRESHOLD: Duration = Duration::from_secs(10 * 60);

#[derive(Default)]
pub struct Tracker {
    running: Arc<AtomicBool>,
    current_snapshot: Arc<Mutex<Option<WindowSnapshot>>>,
    idle_seconds: Arc<AtomicU64>,
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
    pub current_app: Option<String>,
    pub current_window_title: Option<String>,
    pub idle_seconds: u64,
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
        let current_snapshot = Arc::clone(&self.current_snapshot);
        let idle_seconds = Arc::clone(&self.idle_seconds);

        *handle = Some(thread::spawn(move || {
            tracking_loop(app, running, current_snapshot, idle_seconds);
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

        if let Ok(mut snapshot) = self.current_snapshot.lock() {
            *snapshot = None;
        }

        Ok(())
    }

    pub fn status(&self) -> TrackerStatus {
        let snapshot = self
            .current_snapshot
            .lock()
            .ok()
            .and_then(|snapshot| snapshot.clone());

        TrackerStatus {
            running: self.running.load(Ordering::SeqCst),
            current_app: snapshot.as_ref().map(|snapshot| snapshot.app_name.clone()),
            current_window_title: snapshot.and_then(|snapshot| snapshot.window_title),
            idle_seconds: self.idle_seconds.load(Ordering::SeqCst),
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

fn tracking_loop(
    app: AppHandle,
    running: Arc<AtomicBool>,
    current_snapshot: Arc<Mutex<Option<WindowSnapshot>>>,
    idle_seconds: Arc<AtomicU64>,
) {
    let mut current: Option<ActiveSession> = None;

    while running.load(Ordering::SeqCst) {
        let idle_duration = read_idle_duration();
        idle_seconds.store(idle_duration.as_secs(), Ordering::SeqCst);

        if idle_duration >= IDLE_THRESHOLD {
            close_session_at(&app, current.take(), timestamp_before(idle_duration));
            set_current_snapshot(&current_snapshot, None);
            thread::sleep(POLL_INTERVAL);
            continue;
        }

        if let Some(snapshot) = read_active_window() {
            set_current_snapshot(&current_snapshot, Some(snapshot.clone()));

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
    set_current_snapshot(&current_snapshot, None);
    idle_seconds.store(0, Ordering::SeqCst);
}

fn close_session(app: &AppHandle, session: Option<ActiveSession>) {
    close_session_at(app, session, now());
}

fn close_session_at(app: &AppHandle, session: Option<ActiveSession>, end_time: String) {
    let Some(session) = session else {
        return;
    };

    let database = app.state::<Database>();
    let result = database.insert_activity_log(NewActivityLog {
        start_time: session.start_time,
        end_time,
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

fn timestamp_before(duration: Duration) -> String {
    match ChronoDuration::from_std(duration) {
        Ok(duration) => (Utc::now() - duration).to_rfc3339(),
        Err(_) => now(),
    }
}

fn set_current_snapshot(
    current_snapshot: &Arc<Mutex<Option<WindowSnapshot>>>,
    next_snapshot: Option<WindowSnapshot>,
) {
    if let Ok(mut snapshot) = current_snapshot.lock() {
        *snapshot = next_snapshot;
    }
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
