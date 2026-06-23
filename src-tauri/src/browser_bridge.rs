use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

pub const BROWSER_BRIDGE_PORT: u16 = 17653;

const MAX_REQUEST_BYTES: usize = 16 * 1024;
const BROWSER_ACTIVITY_TTL: Duration = Duration::from_secs(15);
const LOOP_SLEEP: Duration = Duration::from_millis(100);

#[derive(Default)]
pub struct BrowserBridge {
    running: Arc<AtomicBool>,
    latest_activity: Arc<Mutex<Option<StoredBrowserActivity>>>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserActivitySnapshot {
    pub browser: Option<String>,
    pub url: String,
    pub title: Option<String>,
    pub observed_at: String,
}

#[derive(Debug, Clone)]
struct StoredBrowserActivity {
    snapshot: BrowserActivitySnapshot,
    received_at: Instant,
}

#[derive(Debug, Deserialize)]
struct BrowserActivityInput {
    browser: Option<String>,
    url: String,
    title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BrowserBridgeStatus {
    pub running: bool,
    pub port: u16,
    pub last_activity: Option<BrowserActivitySnapshot>,
}

impl BrowserBridge {
    pub fn start(&self) -> Result<(), String> {
        let mut handle = self
            .handle
            .lock()
            .map_err(|_| "Не удалось получить доступ к browser bridge handle".to_string())?;

        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        let listener = TcpListener::bind(("127.0.0.1", BROWSER_BRIDGE_PORT))
            .map_err(|error| format!("Не удалось запустить browser bridge: {error}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|error| format!("Не удалось настроить browser bridge: {error}"))?;

        self.running.store(true, Ordering::SeqCst);

        let running = Arc::clone(&self.running);
        let latest_activity = Arc::clone(&self.latest_activity);
        *handle = Some(thread::spawn(move || {
            bridge_loop(listener, running, latest_activity);
        }));

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.running.store(false, Ordering::SeqCst);

        let mut handle = self
            .handle
            .lock()
            .map_err(|_| "Не удалось получить доступ к browser bridge handle".to_string())?;

        if let Some(handle) = handle.take() {
            handle
                .join()
                .map_err(|_| "Browser bridge завершился с ошибкой".to_string())?;
        }

        Ok(())
    }

    pub fn status(&self) -> BrowserBridgeStatus {
        BrowserBridgeStatus {
            running: self.running.load(Ordering::SeqCst),
            port: BROWSER_BRIDGE_PORT,
            last_activity: self.latest_activity(),
        }
    }

    pub fn latest_for_browser(&self, app_name: &str) -> Option<BrowserActivitySnapshot> {
        if !is_supported_browser_process(app_name) {
            return None;
        }

        self.latest_activity()
    }

    fn latest_activity(&self) -> Option<BrowserActivitySnapshot> {
        let activity = self
            .latest_activity
            .lock()
            .ok()
            .and_then(|activity| activity.clone())?;

        if activity.received_at.elapsed() <= BROWSER_ACTIVITY_TTL {
            Some(activity.snapshot)
        } else {
            None
        }
    }
}

impl Drop for BrowserBridge {
    fn drop(&mut self) {
        if let Err(error) = self.stop() {
            eprintln!("Не удалось остановить browser bridge: {error}");
        }
    }
}

#[tauri::command]
pub fn get_browser_bridge_status(
    bridge: tauri::State<BrowserBridge>,
) -> Result<BrowserBridgeStatus, String> {
    Ok(bridge.status())
}

fn bridge_loop(
    listener: TcpListener,
    running: Arc<AtomicBool>,
    latest_activity: Arc<Mutex<Option<StoredBrowserActivity>>>,
) {
    while running.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => handle_client(stream, &latest_activity),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(LOOP_SLEEP);
            }
            Err(error) => {
                eprintln!("Ошибка browser bridge: {error}");
                thread::sleep(LOOP_SLEEP);
            }
        }
    }
}

fn handle_client(
    mut stream: TcpStream,
    latest_activity: &Arc<Mutex<Option<StoredBrowserActivity>>>,
) {
    let request = match read_request(&mut stream) {
        Ok(request) => request,
        Err(error) => {
            let _ = write_response(&mut stream, 400, &format!(r#"{{"error":"{error}"}}"#));
            return;
        }
    };

    if request.starts_with("OPTIONS /browser-activity ") {
        let _ = write_response(&mut stream, 204, "");
        return;
    }

    if !request.starts_with("POST /browser-activity ") {
        let _ = write_response(&mut stream, 404, r#"{"error":"not found"}"#);
        return;
    }

    let Some(body) = request.split("\r\n\r\n").nth(1) else {
        let _ = write_response(&mut stream, 400, r#"{"error":"empty body"}"#);
        return;
    };

    let Ok(input) = serde_json::from_str::<BrowserActivityInput>(body) else {
        let _ = write_response(&mut stream, 400, r#"{"error":"invalid json"}"#);
        return;
    };

    if !is_allowed_browser_url(&input.url) {
        let _ = write_response(&mut stream, 204, "");
        return;
    }

    let snapshot = BrowserActivitySnapshot {
        browser: input.browser,
        url: input.url,
        title: input.title,
        observed_at: Utc::now().to_rfc3339(),
    };

    if let Ok(mut activity) = latest_activity.lock() {
        *activity = Some(StoredBrowserActivity {
            snapshot,
            received_at: Instant::now(),
        });
    }

    let _ = write_response(&mut stream, 204, "");
}

fn read_request(stream: &mut TcpStream) -> Result<String, String> {
    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|error| error.to_string())?;

    let mut request = Vec::new();
    let mut chunk = [0u8; 1024];

    loop {
        let size = stream.read(&mut chunk).map_err(|error| error.to_string())?;

        if size == 0 {
            break;
        }

        request.extend_from_slice(&chunk[..size]);

        if request.len() > MAX_REQUEST_BYTES {
            return Err("request too large".to_string());
        }

        if request_complete(&request) {
            break;
        }
    }

    if request.is_empty() {
        return Err("empty request".to_string());
    }

    String::from_utf8(request).map_err(|error| error.to_string())
}

fn request_complete(request: &[u8]) -> bool {
    let Ok(request_text) = std::str::from_utf8(request) else {
        return false;
    };

    let Some(header_end) = request_text.find("\r\n\r\n") else {
        return false;
    };

    let content_length = request_text[..header_end]
        .lines()
        .find_map(|line| {
            line.split_once(':').and_then(|(key, value)| {
                key.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim())
            })
        })
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0);

    request.len() >= header_end + 4 + content_length
}

fn write_response(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let reason = match status {
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "OK",
    };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );

    stream.write_all(response.as_bytes())
}

fn is_allowed_browser_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

fn is_supported_browser_process(app_name: &str) -> bool {
    let app_name = app_name.to_lowercase();

    matches!(
        app_name.as_str(),
        "chrome.exe" | "msedge.exe" | "firefox.exe" | "brave.exe" | "vivaldi.exe" | "opera.exe"
    )
}
