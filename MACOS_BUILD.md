# macOS build notes

## Что уже готово

- Tauri bundle уже содержит `icon.icns`.
- `identifier` задан как `com.focusflow.desktop`.
- Основной desktop build стабильно собирается на Windows для проверки frontend/Rust-части.

## Что нужно для реальной сборки под macOS

Собрать `.app` / `.dmg` из этого проекта нужно на macOS-хосте.

Минимальный набор:

1. Xcode Command Line Tools
2. Rust toolchain
3. Node.js и npm
4. Tauri CLI

## Базовый сценарий на Mac

```bash
npm install
```

```bash
npm run tauri build
```

Готовые артефакты Tauri соберет в `src-tauri/target/release/bundle/`.

## Что проверить на первом macOS-прогоне

1. Запускается ли приложение как single instance.
2. Работает ли hiding to tray / menu bar behavior так, как ожидается на macOS.
3. Корректно ли открывается главное окно после повторного запуска.
4. Доступны ли локальная база, Ollama-вызовы и browser bridge.
5. Не требует ли трекинг окон отдельного macOS permission flow.

## Важно

С текущего Windows-хоста можно подготовить проект, но не выпустить полноценный нативный `.app` / `.dmg`.
Следующий реальный шаг — открыть проект на Mac и прогнать сборку там.
