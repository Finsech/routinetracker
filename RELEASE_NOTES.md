# Release Notes

## FocusFlow 0.1.4

Дата релиза: 2026-06-30

### Что вошло в обновление

- Завершен рефакторинг строк и идентификаторов:
  - введены стабильные `FlowId` и `SettingKey`;
  - критичная логика больше не зависит от русских UI-лейблов;
  - `Сегодня`, `Настройки` и аналитические расчеты опираются на id, а не на отображаемые строки.
- Сведены дефолты frontend/backend:
  - единый контракт настроек;
  - mock, browser fallback, LLM defaults и backend seed-значения больше не живут как отдельные независимые копии.
- Дочищен санитарный слой проекта:
  - `ROADMAP.md` и `SPECIFICATION.md` полностью переписаны в чистом UTF-8;
  - добавлен `npm run check:strings`;
  - добавлен guardrail против mojibake;
  - вынесены frontend error strings, backend service helpers и LLM prompt strings в отдельные слои.
- Снижен риск повторных проблем с битой кириллицей:
  - тексты ошибок и служебных сообщений меньше размазаны по коду;
  - структура строк стала заметно устойчивее для следующих релизов.

### Что проверено

- `npm run check:strings`
- `npm run build`
- `cargo check`
- `npm run tauri build`
- macOS bundle build: GitHub Actions `macOS Build`

### Windows-артефакты

- `src-tauri/target/release/focusflow.exe`
- `src-tauri/target/release/bundle/msi/FocusFlow_0.1.4_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/FocusFlow_0.1.4_x64-setup.exe`

### macOS

- в релиз прикладывается свежий unsigned `.dmg` из GitHub Actions;
- это подходит для внутренней проверки и open-source distribution;
- signing/notarization остаются отдельным будущим слоем.

### Что дальше после 0.1.4

- продолжать обкатку `0.1.4` на длинных реальных днях;
- собирать продуктовые багфиксы уже поверх очищенной кодовой базы;
- отдельно решать, нужен ли следующий цикл вокруг macOS polished distribution.
