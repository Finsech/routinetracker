use crate::browser_bridge::BrowserBridge;
use crate::database::{Database, NewActivityLog, NewIdleLog, StoplistItem};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Manager};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const EVENT_WAIT_SLICE: Duration = Duration::from_millis(250);
const IDLE_THRESHOLD: Duration = Duration::from_secs(10 * 60);
const MIN_ACTIVITY_DURATION: Duration = Duration::from_secs(5);
const WAKE_GAP_THRESHOLD: Duration = Duration::from_secs(15);

#[cfg(target_os = "windows")]
static FOREGROUND_CHANGED: AtomicBool = AtomicBool::new(false);

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

    fn shutdown(&self) {
        if let Err(error) = self.stop() {
            eprintln!("Не удалось остановить tracker: {error}");
        }
    }
}

impl Drop for Tracker {
    fn drop(&mut self) {
        self.shutdown();
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
    let mut idle_start: Option<String> = None;
    let mut last_snapshot_poll = Instant::now()
        .checked_sub(POLL_INTERVAL)
        .unwrap_or_else(Instant::now);
    let mut last_wall_clock = SystemTime::now();
    let _foreground_hook = install_foreground_event_hook();

    while running.load(Ordering::SeqCst) {
        let current_wall_clock = SystemTime::now();
        let wake_gap = current_wall_clock
            .duration_since(last_wall_clock)
            .ok()
            .filter(|gap| *gap >= WAKE_GAP_THRESHOLD);
        last_wall_clock = current_wall_clock;

        if let Some(gap) = wake_gap {
            let gap_started_at = timestamp_before(gap);
            close_session_at(&app, current.take(), gap_started_at);
            set_current_snapshot(&current_snapshot, None);
            last_snapshot_poll = Instant::now()
                .checked_sub(POLL_INTERVAL)
                .unwrap_or_else(Instant::now);
        }

        let idle_duration = read_idle_duration();
        idle_seconds.store(idle_duration.as_secs(), Ordering::SeqCst);

        if idle_duration >= IDLE_THRESHOLD {
            let last_input_time = timestamp_before(idle_duration);
            let had_current_session = current.is_some();

            close_session_at(&app, current.take(), last_input_time.clone());
            set_current_snapshot(&current_snapshot, None);
            if idle_start.is_none() && had_current_session {
                idle_start = Some(last_input_time);
            }
            wait_for_next_tracking_iteration(&running, &mut last_snapshot_poll);
            continue;
        }

        if let Some(start_time) = idle_start.take() {
            close_idle_session(&app, start_time, now());
        }

        if should_refresh_snapshot(&mut last_snapshot_poll) {
            if let Some(snapshot) = read_active_window() {
                let snapshot = enrich_browser_snapshot(&app, snapshot);

                if is_stoplisted(&app, &snapshot) {
                    close_session(&app, current.take());
                    set_current_snapshot(&current_snapshot, None);
                    wait_for_next_tracking_iteration(&running, &mut last_snapshot_poll);
                    continue;
                }

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
            } else {
                close_session(&app, current.take());
                set_current_snapshot(&current_snapshot, None);
            }
        }

        wait_for_next_tracking_iteration(&running, &mut last_snapshot_poll);
    }

    close_session(&app, current);
    if let Some(start_time) = idle_start {
        close_idle_session(&app, start_time, now());
    }
    set_current_snapshot(&current_snapshot, None);
    idle_seconds.store(0, Ordering::SeqCst);
}

fn is_stoplisted(app: &AppHandle, snapshot: &WindowSnapshot) -> bool {
    let database = app.state::<Database>();

    match database.list_stoplist() {
        Ok(items) => items.iter().any(|item| stoplist_matches(item, snapshot)),
        Err(error) => {
            eprintln!("Не удалось прочитать стоп-лист: {error}");
            false
        }
    }
}

fn stoplist_matches(item: &StoplistItem, snapshot: &WindowSnapshot) -> bool {
    let item_type = item.item_type.to_lowercase();
    let value = item.value.to_lowercase();

    match item_type.as_str() {
        "app" => snapshot.app_name.to_lowercase() == value,
        "site" => snapshot
            .url
            .as_ref()
            .map(|url| url.to_lowercase().contains(&value))
            .unwrap_or(false),
        _ => false,
    }
}

fn enrich_browser_snapshot(app: &AppHandle, mut snapshot: WindowSnapshot) -> WindowSnapshot {
    let browser_bridge = app.state::<BrowserBridge>();

    if let Some(activity) = browser_bridge.latest_for_browser(&snapshot.app_name) {
        snapshot.url = Some(activity.url);

        if snapshot.window_title.is_none() {
            snapshot.window_title = activity.title;
        }
    }

    snapshot
}

fn close_session(app: &AppHandle, session: Option<ActiveSession>) {
    close_session_at(app, session, now());
}

fn close_session_at(app: &AppHandle, session: Option<ActiveSession>, end_time: String) {
    let Some(session) = session else {
        return;
    };

    if !should_save_session(&session.start_time, &end_time) {
        return;
    }

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

fn should_save_session(start_time: &str, end_time: &str) -> bool {
    let Ok(start) = DateTime::parse_from_rfc3339(start_time) else {
        return true;
    };
    let Ok(end) = DateTime::parse_from_rfc3339(end_time) else {
        return true;
    };

    match (end.with_timezone(&Utc) - start.with_timezone(&Utc)).to_std() {
        Ok(duration) => duration >= MIN_ACTIVITY_DURATION,
        Err(_) => false,
    }
}

fn close_idle_session(app: &AppHandle, start_time: String, end_time: String) {
    let database = app.state::<Database>();
    let result = database.insert_idle_log(NewIdleLog {
        start_time,
        end_time,
        note: None,
        ignored: false,
    });

    if let Err(error) = result {
        eprintln!("Не удалось сохранить простой: {error}");
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

fn should_refresh_snapshot(last_snapshot_poll: &mut Instant) -> bool {
    if take_foreground_changed_signal() || last_snapshot_poll.elapsed() >= POLL_INTERVAL {
        *last_snapshot_poll = Instant::now();
        return true;
    }

    false
}

fn wait_for_next_tracking_iteration(running: &AtomicBool, last_snapshot_poll: &mut Instant) {
    while running.load(Ordering::SeqCst)
        && !foreground_change_pending()
        && last_snapshot_poll.elapsed() < POLL_INTERVAL
    {
        let remaining = POLL_INTERVAL.saturating_sub(last_snapshot_poll.elapsed());
        wait_for_tracking_signal(remaining.min(EVENT_WAIT_SLICE));
    }
}

#[cfg(target_os = "windows")]
struct ForegroundEventHook {
    hook: windows::Win32::UI::Accessibility::HWINEVENTHOOK,
}

#[cfg(target_os = "windows")]
impl Drop for ForegroundEventHook {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::UI::Accessibility::UnhookWinEvent(self.hook);
        }
    }
}

#[cfg(target_os = "windows")]
fn install_foreground_event_hook() -> Option<ForegroundEventHook> {
    use windows::Win32::UI::Accessibility::SetWinEventHook;
    use windows::Win32::UI::WindowsAndMessaging::{EVENT_SYSTEM_FOREGROUND, WINEVENT_OUTOFCONTEXT};

    let hook = unsafe {
        SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(foreground_event_callback),
            0,
            0,
            WINEVENT_OUTOFCONTEXT,
        )
    };

    if hook.is_invalid() {
        eprintln!("Не удалось подключить foreground hook, трекер продолжит работать через polling");
        None
    } else {
        FOREGROUND_CHANGED.store(true, Ordering::SeqCst);
        Some(ForegroundEventHook { hook })
    }
}

#[cfg(not(target_os = "windows"))]
fn install_foreground_event_hook() -> Option<()> {
    None
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn foreground_event_callback(
    _hook: windows::Win32::UI::Accessibility::HWINEVENTHOOK,
    _event: u32,
    _hwnd: windows::Win32::Foundation::HWND,
    _object_id: i32,
    _child_id: i32,
    _event_thread_id: u32,
    _event_time: u32,
) {
    FOREGROUND_CHANGED.store(true, Ordering::SeqCst);
}

#[cfg(target_os = "windows")]
fn foreground_change_pending() -> bool {
    FOREGROUND_CHANGED.load(Ordering::SeqCst)
}

#[cfg(not(target_os = "windows"))]
fn foreground_change_pending() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn take_foreground_changed_signal() -> bool {
    FOREGROUND_CHANGED.swap(false, Ordering::SeqCst)
}

#[cfg(not(target_os = "windows"))]
fn take_foreground_changed_signal() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn wait_for_tracking_signal(timeout: Duration) {
    use windows::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, MsgWaitForMultipleObjects, PeekMessageW, TranslateMessage, MSG,
        PM_REMOVE, QS_ALLINPUT,
    };

    let timeout_ms = timeout.as_millis().min(u32::MAX as u128) as u32;

    unsafe {
        let _ = MsgWaitForMultipleObjects(None, false, timeout_ms, QS_ALLINPUT);

        let mut message = MSG::default();
        while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn wait_for_tracking_signal(timeout: Duration) {
    thread::sleep(timeout);
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
