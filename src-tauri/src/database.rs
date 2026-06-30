use crate::messages::{service_error, ERROR_DATABASE_LOCKED, ERROR_UNSUPPORTED_EXPORT_FORMAT};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const SETTING_LANGUAGE: &str = "language";
const SETTING_THEME: &str = "theme";
const SETTING_AUTOSTART: &str = "autostart";
const SETTING_LLM_PROVIDER: &str = "llm_provider";
const SETTING_OLLAMA_URL: &str = "ollama_url";
const SETTING_LLM_MODEL: &str = "llm_model";
const SETTING_EXPORT_FORMAT: &str = "export_format";

const DEFAULT_LANGUAGE: &str = "Русский";
const DEFAULT_THEME: &str = "Системная";
const DEFAULT_AUTOSTART: &str = "Выключен";
const DEFAULT_LLM_PROVIDER: &str = "ollama";
const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";
const DEFAULT_LLM_MODEL: &str = "qwen2.5:7b-instruct";
const DEFAULT_EXPORT_FORMAT: &str = "JSON";
const LEGACY_LLM_MODEL_GPT_OSS: &str = "gpt-oss:20b";

const DEFAULT_SETTINGS: [(&str, &str); 7] = [
    (SETTING_LANGUAGE, DEFAULT_LANGUAGE),
    (SETTING_THEME, DEFAULT_THEME),
    (SETTING_AUTOSTART, DEFAULT_AUTOSTART),
    (SETTING_LLM_PROVIDER, DEFAULT_LLM_PROVIDER),
    (SETTING_OLLAMA_URL, DEFAULT_OLLAMA_URL),
    (SETTING_LLM_MODEL, DEFAULT_LLM_MODEL),
    (SETTING_EXPORT_FORMAT, DEFAULT_EXPORT_FORMAT),
];

pub struct Database {
    connection: Mutex<Connection>,
}

#[derive(Debug, Serialize)]
pub struct ActivityLog {
    pub id: i64,
    pub start_time: String,
    pub end_time: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IdleLog {
    pub id: i64,
    pub start_time: String,
    pub end_time: String,
    pub note: Option<String>,
    pub ignored: bool,
    pub reviewed: bool,
}

#[derive(Debug, Deserialize)]
pub struct NewActivityLog {
    pub start_time: String,
    pub end_time: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NewIdleLog {
    pub start_time: String,
    pub end_time: String,
    pub note: Option<String>,
    pub ignored: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIdleLog {
    pub note: Option<String>,
    pub ignored: bool,
    pub reviewed: bool,
}

#[derive(Debug, Serialize)]
pub struct SettingEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct StoplistItem {
    pub id: i64,
    pub item_type: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct LlmSummary {
    pub id: i64,
    pub date_key: String,
    pub payload_signature: String,
    pub provider: String,
    pub model: String,
    pub groups_json: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct FocusFlowExport {
    pub app_name: String,
    pub schema_version: i64,
    pub exported_at: String,
    pub data: FocusFlowExportData,
}

#[derive(Debug, Serialize)]
pub struct FocusFlowExportData {
    pub activity_logs: Vec<ActivityLog>,
    pub idle_logs: Vec<IdleLog>,
    pub settings: Vec<SettingEntry>,
    pub stoplist: Vec<StoplistItem>,
    pub llm_summaries: Vec<LlmSummary>,
}

#[derive(Debug, Deserialize)]
pub struct NewStoplistItem {
    pub item_type: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveLlmSummaryInput {
    pub date_key: String,
    pub payload_signature: String,
    pub provider: String,
    pub model: String,
    pub groups_json: String,
}

impl Database {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let db_path = database_path(app)?;
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| service_error("Не удалось создать папку данных", error))?;
        }

        let connection = Connection::open(db_path)
            .map_err(|error| service_error("Не удалось открыть SQLite", error))?;
        run_migrations(&connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn with_connection<T>(
        &self,
        action: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| ERROR_DATABASE_LOCKED.to_string())?;

        action(&connection)
    }

    pub fn insert_activity_log(&self, input: NewActivityLog) -> Result<ActivityLog, String> {
        self.with_connection(|connection| {
            connection
                .execute(
                    "INSERT INTO activity_log (start_time, end_time, app_name, window_title, url)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        input.start_time,
                        input.end_time,
                        input.app_name,
                        input.window_title,
                        input.url
                    ],
                )
                .map_err(|error| error.to_string())?;

            let id = connection.last_insert_rowid();
            get_activity_log_by_id(connection, id)
        })
    }

    pub fn insert_idle_log(&self, input: NewIdleLog) -> Result<IdleLog, String> {
        self.with_connection(|connection| {
            connection
                .execute(
                    "INSERT INTO idle_log (start_time, end_time, note, ignored)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![input.start_time, input.end_time, input.note, input.ignored],
                )
                .map_err(|error| error.to_string())?;

            let id = connection.last_insert_rowid();
            get_idle_log_by_id(connection, id)
        })
    }

    pub fn list_stoplist(&self) -> Result<Vec<StoplistItem>, String> {
        self.with_connection(read_stoplist)
    }
}

#[tauri::command]
pub fn get_activity_logs(database: tauri::State<Database>) -> Result<Vec<ActivityLog>, String> {
    database.with_connection(read_activity_logs)
}

#[tauri::command]
pub fn create_activity_log(
    database: tauri::State<Database>,
    input: NewActivityLog,
) -> Result<ActivityLog, String> {
    database.insert_activity_log(input)
}

#[tauri::command]
pub fn get_idle_logs(database: tauri::State<Database>) -> Result<Vec<IdleLog>, String> {
    database.with_connection(read_idle_logs)
}

#[tauri::command]
pub fn create_idle_log(
    database: tauri::State<Database>,
    input: NewIdleLog,
) -> Result<IdleLog, String> {
    database.insert_idle_log(input)
}

#[tauri::command]
pub fn update_idle_log(
    database: tauri::State<Database>,
    id: i64,
    input: UpdateIdleLog,
) -> Result<IdleLog, String> {
    database.with_connection(|connection| {
        connection
            .execute(
                "UPDATE idle_log
                 SET note = ?1, ignored = ?2, reviewed = ?3
                 WHERE id = ?4",
                params![input.note, input.ignored, input.reviewed, id],
            )
            .map_err(|error| error.to_string())?;

        get_idle_log_by_id(connection, id)
    })
}

#[tauri::command]
pub fn get_settings(database: tauri::State<Database>) -> Result<Vec<SettingEntry>, String> {
    database.with_connection(read_settings)
}

#[tauri::command]
pub fn set_setting(
    database: tauri::State<Database>,
    key: String,
    value: String,
) -> Result<(), String> {
    database.with_connection(|connection| {
        connection
            .execute(
                "INSERT INTO settings (key, value)
                 VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    })
}

#[tauri::command]
pub fn get_stoplist(database: tauri::State<Database>) -> Result<Vec<StoplistItem>, String> {
    database.list_stoplist()
}

#[tauri::command]
pub fn add_stoplist_item(
    database: tauri::State<Database>,
    input: NewStoplistItem,
) -> Result<StoplistItem, String> {
    database.with_connection(|connection| {
        connection
            .execute(
                "INSERT INTO stoplist (type, value) VALUES (?1, ?2)",
                params![input.item_type, input.value],
            )
            .map_err(|error| error.to_string())?;

        let id = connection.last_insert_rowid();
        get_stoplist_item_by_id(connection, id)
    })
}

#[tauri::command]
pub fn remove_stoplist_item(database: tauri::State<Database>, id: i64) -> Result<(), String> {
    database.with_connection(|connection| {
        connection
            .execute("DELETE FROM stoplist WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;

        Ok(())
    })
}

#[tauri::command]
pub fn get_llm_summary(
    database: tauri::State<Database>,
    date_key: String,
    payload_signature: String,
    provider: String,
    model: String,
) -> Result<Option<LlmSummary>, String> {
    database.with_connection(|connection| {
        connection
            .query_row(
                "SELECT id, date_key, payload_signature, provider, model, groups_json, created_at
                 FROM llm_summary
                 WHERE date_key = ?1
                   AND payload_signature = ?2
                   AND provider = ?3
                   AND model = ?4
                 ORDER BY created_at DESC
                 LIMIT 1",
                params![date_key, payload_signature, provider, model],
                |row| {
                    Ok(LlmSummary {
                        id: row.get(0)?,
                        date_key: row.get(1)?,
                        payload_signature: row.get(2)?,
                        provider: row.get(3)?,
                        model: row.get(4)?,
                        groups_json: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub fn save_llm_summary(
    database: tauri::State<Database>,
    input: SaveLlmSummaryInput,
) -> Result<LlmSummary, String> {
    database.with_connection(|connection| {
        connection
            .execute(
                "INSERT INTO llm_summary (
                    date_key,
                    payload_signature,
                    provider,
                    model,
                    groups_json
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(date_key, payload_signature, provider, model)
                 DO UPDATE SET
                    groups_json = excluded.groups_json,
                    created_at = CURRENT_TIMESTAMP",
                params![
                    input.date_key,
                    input.payload_signature,
                    input.provider,
                    input.model,
                    input.groups_json
                ],
            )
            .map_err(|error| error.to_string())?;

        get_llm_summary_by_key(
            connection,
            &input.date_key,
            &input.payload_signature,
            &input.provider,
            &input.model,
        )
    })
}

#[tauri::command]
pub fn get_llm_summaries(database: tauri::State<Database>) -> Result<Vec<LlmSummary>, String> {
    database.with_connection(read_llm_summaries)
}

#[tauri::command]
pub fn export_focusflow_data(
    app: AppHandle,
    database: tauri::State<Database>,
    format: String,
) -> Result<String, String> {
    let export = database.with_connection(|connection| {
        Ok(FocusFlowExport {
            app_name: "FocusFlow".to_string(),
            schema_version: 1,
            exported_at: chrono::Utc::now().to_rfc3339(),
            data: FocusFlowExportData {
                activity_logs: read_activity_logs(connection)?,
                idle_logs: read_idle_logs(connection)?,
                settings: read_settings(connection)?,
                stoplist: read_stoplist(connection)?,
                llm_summaries: read_llm_summaries(connection)?,
            },
        })
    })?;

    let normalized_format = format.trim().to_ascii_lowercase();
    let extension = match normalized_format.as_str() {
        "json" => "json",
        "csv" => "csv",
        _ => return Err(ERROR_UNSUPPORTED_EXPORT_FORMAT.to_string()),
    };

    let export_dir = export_path(&app)?;
    fs::create_dir_all(&export_dir)
        .map_err(|error| service_error("Не удалось создать папку экспорта", error))?;

    let file_name = format!(
        "focusflow-export-{}.{}",
        chrono::Local::now().format("%Y-%m-%d-%H%M%S"),
        extension
    );
    let file_path = export_dir.join(file_name);
    let content = if extension == "json" {
        serde_json::to_string_pretty(&export)
            .map_err(|error| service_error("Не удалось подготовить JSON-экспорт", error))?
    } else {
        build_export_csv(&export)
    };

    fs::write(&file_path, content)
        .map_err(|error| service_error("Не удалось сохранить экспорт", error))?;

    Ok(file_path.display().to_string())
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("focusflow.sqlite3"))
        .map_err(|error| service_error("Не удалось определить папку данных приложения", error))
}

fn export_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = app.path().download_dir() {
        return Ok(path);
    }

    if let Ok(path) = app.path().document_dir() {
        return Ok(path);
    }

    app.path()
        .app_data_dir()
        .map_err(|error| service_error("Не удалось определить папку для экспорта", error))
}

fn run_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                app_name TEXT NOT NULL,
                window_title TEXT,
                url TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS idle_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                note TEXT,
                ignored INTEGER NOT NULL DEFAULT 0,
                reviewed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS stoplist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                value TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS llm_summary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date_key TEXT NOT NULL,
                payload_signature TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                groups_json TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date_key, payload_signature, provider, model)
            );
            ",
        )
        .map_err(|error| service_error("Не удалось применить миграции SQLite", error))?;

    seed_default_settings(connection)?;
    migrate_legacy_setting_values(connection)?;

    ensure_column(
        connection,
        "idle_log",
        "reviewed",
        "ALTER TABLE idle_log ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0",
    )
}

fn seed_default_settings(connection: &Connection) -> Result<(), String> {
    for (key, value) in DEFAULT_SETTINGS {
        connection
            .execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )
            .map_err(|error| service_error(&format!("Не удалось записать дефолт настройки {key}"), error))?;
    }

    Ok(())
}

fn migrate_legacy_setting_values(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "UPDATE settings SET value = ?1 WHERE key = ?2 AND value = ?3",
            params![
                DEFAULT_LLM_MODEL,
                SETTING_LLM_MODEL,
                LEGACY_LLM_MODEL_GPT_OSS
            ],
        )
        .map_err(|error| service_error("Не удалось обновить legacy-настройки", error))?;

    Ok(())
}

fn get_activity_log_by_id(connection: &Connection, id: i64) -> Result<ActivityLog, String> {
    connection
        .query_row(
            "SELECT id, start_time, end_time, app_name, window_title, url
             FROM activity_log
             WHERE id = ?1",
            params![id],
            |row| {
                Ok(ActivityLog {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    app_name: row.get(3)?,
                    window_title: row.get(4)?,
                    url: row.get(5)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

fn get_idle_log_by_id(connection: &Connection, id: i64) -> Result<IdleLog, String> {
    connection
        .query_row(
            "SELECT id, start_time, end_time, note, ignored, reviewed
             FROM idle_log
             WHERE id = ?1",
            params![id],
            |row| {
                Ok(IdleLog {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    note: row.get(3)?,
                    ignored: row.get(4)?,
                    reviewed: row.get(5)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

fn get_llm_summary_by_key(
    connection: &Connection,
    date_key: &str,
    payload_signature: &str,
    provider: &str,
    model: &str,
) -> Result<LlmSummary, String> {
    connection
        .query_row(
            "SELECT id, date_key, payload_signature, provider, model, groups_json, created_at
             FROM llm_summary
             WHERE date_key = ?1
               AND payload_signature = ?2
               AND provider = ?3
               AND model = ?4
             LIMIT 1",
            params![date_key, payload_signature, provider, model],
            |row| {
                Ok(LlmSummary {
                    id: row.get(0)?,
                    date_key: row.get(1)?,
                    payload_signature: row.get(2)?,
                    provider: row.get(3)?,
                    model: row.get(4)?,
                    groups_json: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

fn read_stoplist(connection: &Connection) -> Result<Vec<StoplistItem>, String> {
    let mut statement = connection
        .prepare("SELECT id, type, value FROM stoplist ORDER BY value ASC")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(StoplistItem {
                id: row.get(0)?,
                item_type: row.get(1)?,
                value: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    alter_sql: &str,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;

    for existing_column in columns {
        if existing_column.map_err(|error| error.to_string())? == column {
            return Ok(());
        }
    }

    connection
        .execute(alter_sql, [])
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn get_stoplist_item_by_id(connection: &Connection, id: i64) -> Result<StoplistItem, String> {
    connection
        .query_row(
            "SELECT id, type, value FROM stoplist WHERE id = ?1",
            params![id],
            |row| {
                Ok(StoplistItem {
                    id: row.get(0)?,
                    item_type: row.get(1)?,
                    value: row.get(2)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

fn read_activity_logs(connection: &Connection) -> Result<Vec<ActivityLog>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, start_time, end_time, app_name, window_title, url
             FROM activity_log
             ORDER BY start_time DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(ActivityLog {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                app_name: row.get(3)?,
                window_title: row.get(4)?,
                url: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_idle_logs(connection: &Connection) -> Result<Vec<IdleLog>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, start_time, end_time, note, ignored, reviewed
             FROM idle_log
             ORDER BY start_time DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(IdleLog {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                note: row.get(3)?,
                ignored: row.get(4)?,
                reviewed: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_settings(connection: &Connection) -> Result<Vec<SettingEntry>, String> {
    let mut statement = connection
        .prepare("SELECT key, value FROM settings ORDER BY key ASC")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(SettingEntry {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_llm_summaries(connection: &Connection) -> Result<Vec<LlmSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, date_key, payload_signature, provider, model, groups_json, created_at
             FROM llm_summary
             ORDER BY created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(LlmSummary {
                id: row.get(0)?,
                date_key: row.get(1)?,
                payload_signature: row.get(2)?,
                provider: row.get(3)?,
                model: row.get(4)?,
                groups_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn build_export_csv(export: &FocusFlowExport) -> String {
    let mut rows = vec![[
        "kind",
        "start_time",
        "end_time",
        "app_name",
        "window_title",
        "url",
        "note",
        "ignored",
        "reviewed",
    ]
    .join(",")];

    rows.extend(export.data.activity_logs.iter().map(|item| {
        [
            "activity".to_string(),
            escape_csv(&item.start_time),
            escape_csv(&item.end_time),
            escape_csv(&item.app_name),
            escape_csv(item.window_title.as_deref().unwrap_or_default()),
            escape_csv(item.url.as_deref().unwrap_or_default()),
            String::new(),
            String::new(),
            String::new(),
        ]
        .join(",")
    }));

    rows.extend(export.data.idle_logs.iter().map(|item| {
        [
            "idle".to_string(),
            escape_csv(&item.start_time),
            escape_csv(&item.end_time),
            String::new(),
            String::new(),
            String::new(),
            escape_csv(item.note.as_deref().unwrap_or_default()),
            item.ignored.to_string(),
            item.reviewed.to_string(),
        ]
        .join(",")
    }));

    rows.join("\n")
}

fn escape_csv(value: &str) -> String {
    let normalized = value.replace('"', "\"\"");
    if normalized.contains(',') || normalized.contains('\n') || normalized.contains('"') {
        format!("\"{normalized}\"")
    } else {
        normalized
    }
}
