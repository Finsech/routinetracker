# Release Notes

## FocusFlow 0.1.0

Дата фиксации релизного состояния: 2026-06-29

### Что входит в релиз

- desktop MVP на `Tauri + Rust + React`;
- локальный трекинг активного окна;
- browser bridge для URL и заголовков вкладок;
- фиксация простоев с review-flow;
- экраны `Сегодня`, `Анализ дня`, `Неделя`, `Настройки`;
- LLM-группировка активности в потоки и стримы;
- локальное хранение данных в SQLite;
- stoplist для приложений и сайтов;
- экспорт данных в JSON;
- работа через system tray;
- Windows installer и первый macOS CI artifact.

### Что проверено

- production frontend build: `npm run build`;
- Rust-проверка: `cargo check`;
- Windows desktop bundle build: `npm run tauri build`;
- первый успешный GitHub Actions build на `macos-latest` с artifact `focusflow-macos-bundle`.

### Windows-артефакты

- `src-tauri/target/release/focusflow.exe`
- `src-tauri/target/release/bundle/msi/FocusFlow_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/FocusFlow_0.1.0_x64-setup.exe`

### macOS

- текущий macOS-результат собирается через GitHub Actions;
- первый успешный artifact: `focusflow-macos-bundle`;
- сборка пока unsigned и подходит для внутренней проверки;
- для полноценного публичного macOS-релиза позже понадобятся signing и notarization.

### Ограничения версии 0.1.0

- browser URL требует установленное расширение из `browser-extension/`;
- качество LLM-группировки зависит от локально доступной Ollama-модели;
- macOS пока публикуется как CI artifact, а не как подписанный production release.
