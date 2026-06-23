use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

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

#[derive(Debug, Deserialize)]
pub struct NewStoplistItem {
    pub item_type: String,
    pub value: String,
}

impl Database {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let db_path = database_path(app)?;
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Не удалось создать папку данных: {error}"))?;
        }

        let connection = Connection::open(db_path)
            .map_err(|error| format!("Не удалось открыть SQLite: {error}"))?;
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
            .map_err(|_| "Соединение с базой данных заблокировано".to_string())?;

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
    database.with_connection(|connection| {
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
    })
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
    database.with_connection(|connection| {
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
    })
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
    database.with_connection(|connection| {
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
    })
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

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("focusflow.sqlite3"))
        .map_err(|error| format!("Не удалось определить папку данных приложения: {error}"))
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

            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('language', 'Русский'),
                ('theme', 'Системная'),
                ('autostart', 'Выключен'),
                ('llm_provider', 'ollama'),
                ('ollama_url', 'http://localhost:11434'),
                ('llm_model', 'gpt-oss:20b'),
                ('export_format', 'JSON');
            ",
        )
        .map_err(|error| format!("Не удалось применить миграции SQLite: {error}"))?;

    ensure_column(
        connection,
        "idle_log",
        "reviewed",
        "ALTER TABLE idle_log ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0",
    )
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
