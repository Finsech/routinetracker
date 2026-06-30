# macOS Build Notes

## Что уже готово

- Tauri bundle уже содержит `icon.icns`.
- `identifier` задан как `com.focusflow.desktop`.
- macOS build проходит через GitHub Actions и отдает `.app` и `.dmg`.

## Что важно понимать

Текущий `dmg` публикуется как **unsigned** build. Это нормально для внутренней проверки и open-source дистрибуции, но это еще не финальный polished macOS release.

## Как открыть неподписанный FocusFlow на macOS

Если macOS не дает открыть приложение:

1. Сначала попробуй открыть приложение обычным способом.
2. После предупреждения открой `System Settings`.
3. Перейди в `Privacy & Security`.
4. Внизу окна нажми `Open Anyway`.
5. Подтверди запуск приложения.

Согласно Apple, кнопка `Open Anyway` обычно доступна около часа после первой попытки запуска.

Официальные ссылки:

- https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac
- https://support.apple.com/en-us/102445

## Что нужно для локальной сборки на Mac

Минимальный набор:

1. Xcode Command Line Tools
2. Rust toolchain
3. Node.js и npm
4. Tauri CLI

## Базовый сценарий сборки на Mac

```bash
npm install
```

```bash
npm run tauri build
```

Готовые артефакты Tauri сложит в `src-tauri/target/release/bundle/`.

## Что проверить на первом macOS-прогоне

1. Запускается ли приложение как single instance.
2. Работает ли tray / menu bar сценарий как ожидается на macOS.
3. Корректно ли повторно открывается окно.
4. Работают ли локальная база, Ollama-вызовы и browser bridge.
5. Не требует ли трекинг окон отдельного macOS permission flow.
