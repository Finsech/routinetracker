# Release Notes

## FocusFlow 0.1.0

Дата фиксации релизного состояния: 2026-06-24

### Что готово

- desktop MVP на `Tauri + Rust + React`;
- локальный трекинг активного окна и браузерных URL через browser bridge;
- фиксация idle-интервалов с review-flow;
- экраны `Сегодня`, `Неделя`, `Аналитика`, `Настройки`;
- LLM-группировка дня с сохранением результатов в SQLite;
- stoplist для приложений и сайтов;
- экспорт данных в JSON;
- Dayflow-inspired UI для основных экранов.

### Что проверено

- production frontend build: `npm run build`;
- Rust-проверка: `cargo check`;
- desktop bundle build: `npm run tauri build`;
- запуск собранного бинарника:
  - `src-tauri/target/release/focusflow.exe`

### Готовые артефакты

- `src-tauri/target/release/focusflow.exe`
- `src-tauri/target/release/bundle/msi/FocusFlow_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/FocusFlow_0.1.0_x64-setup.exe`

### Known limitations

- browser URL требует установленное расширение из `browser-extension/`;
- LLM-группировка зависит от локально доступной Ollama-модели;
- отложенный инженерный хвост вынесен в `ENGINEERING_BACKLOG.md` и не блокирует упаковку MVP.
