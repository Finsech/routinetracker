# Release Notes

## FocusFlow 0.1.1

Дата релиза: 2026-06-30

### Что вошло в обновление

- single-instance режим: повторный запуск приложения теперь разворачивает уже работающий экземпляр вместо второй копии;
- улучшена LLM-группировка:
  - payload сохраняет полезные заголовки документов, вкладок и страниц;
  - в группировку передаются несколько примеров на контекст;
  - добавлены явные подсказки для коммуникационных приложений и сайтов;
  - добавлена защита от мусорных и иероглифических названий стримов;
- усилена базовая классификация коммуникаций для:
  - Telegram
  - Slack
  - WhatsApp
  - Discord
  - MAX
  - Yandex Messenger
  - и их web-версий.

### Что проверено

- production frontend build: `npm run build`
- Rust-проверка: `cargo check`
- Windows desktop bundle build: `npm run tauri build`

### Windows-артефакты

- `src-tauri/target/release/focusflow.exe`
- `src-tauri/target/release/bundle/msi/FocusFlow_0.1.1_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/FocusFlow_0.1.1_x64-setup.exe`

### macOS

- macOS-сборка продолжает идти через GitHub Actions;
- текущая сборка остается unsigned и подходит для внутренней проверки;
- при публикации `0.1.1` можно прикладывать актуальный CI-артефакт как test build.

### Что еще остается после 0.1.1

- финально добить таймлайн дня;
- починить годовую heatmap;
- улучшить day analysis date picker;
- пройти остаточные UX-баги перед следующим обновлением.
