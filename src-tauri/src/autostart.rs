#[cfg(target_os = "windows")]
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
#[cfg(target_os = "windows")]
use winreg::RegKey;

const RUN_KEY_PATH: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "FocusFlow";

#[tauri::command]
pub fn get_autostart_status() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu
            .open_subkey_with_flags(RUN_KEY_PATH, KEY_READ)
            .map_err(|error| format!("Не удалось открыть ключ автозапуска: {error}"))?;

        return match key.get_value::<String, _>(VALUE_NAME) {
            Ok(value) => Ok(!value.trim().is_empty()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(format!("Не удалось прочитать автозапуск: {error}")),
        };
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn set_autostart_status(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu
            .create_subkey(RUN_KEY_PATH)
            .map_err(|error| format!("Не удалось открыть раздел автозапуска: {error}"))?;

        if enabled {
            let exe_path = std::env::current_exe()
                .map_err(|error| format!("Не удалось определить путь к приложению: {error}"))?;
            let command = format!("\"{}\"", exe_path.display());

            key.set_value(VALUE_NAME, &command)
                .map_err(|error| format!("Не удалось включить автозапуск: {error}"))?;
        } else {
            match key.delete_value(VALUE_NAME) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!("Не удалось выключить автозапуск: {error}"));
                }
            }
        }

        return get_autostart_status();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}
