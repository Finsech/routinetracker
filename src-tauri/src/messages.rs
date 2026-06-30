use std::fmt::Display;

pub const ERROR_DATABASE_LOCKED: &str = "Соединение с базой данных заблокировано";
pub const ERROR_BROWSER_BRIDGE_HANDLE: &str = "Не удалось получить доступ к browser bridge handle";
pub const ERROR_BROWSER_BRIDGE_THREAD: &str = "Browser bridge завершился с ошибкой";
pub const ERROR_TRACKER_HANDLE: &str = "Не удалось получить доступ к tracker handle";
pub const ERROR_TRACKER_THREAD: &str = "Фоновый tracker завершился с ошибкой";
pub const ERROR_UNSUPPORTED_EXPORT_FORMAT: &str = "Неподдерживаемый формат экспорта";

pub fn service_error(action: &str, error: impl Display) -> String {
    format!("{action}: {error}")
}

pub fn log_service_error(action: &str, error: impl Display) {
    eprintln!("{}", service_error(action, error));
}
