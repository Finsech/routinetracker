# FocusFlow

FocusFlow - локальный desktop-трекер экранного времени и продуктивности для Windows 11.

Проект строится на Tauri + React + Rust. UI на старте русскоязычный, промежуточные интерфейсные варианты можно смотреть в браузере через Vite, а native-функции проверяются через Tauri desktop dev mode.

## Команды

Установить зависимости:

```bash
npm install
```

Запустить web-preview:

```bash
npm run dev
```

Проверить frontend-сборку:

```bash
npm run build
```

Проверить Rust/Tauri:

```bash
cd src-tauri
cargo check
```

Запустить desktop dev mode:

```bash
npm run tauri dev
```

## Документация

- `SPECIFICATION.md` - основная спецификация продукта.
- `ROADMAP.md` - текущий статус и порядок работ.
- `AGENTS.md` - правила работы AI-агента в проекте.
- `orchestrator/` - отложенная идея будущего оркестратора разработки.

## Текущий статус

Готов официальный scaffold Tauri + React, подключены Tailwind CSS и shadcn/ui. Первый UI-прототип на мок-данных разложен на страницы, app-shell и dashboard-компоненты.

На Rust-стороне добавлен SQLite-слой с миграциями и Tauri-командами для activity log, settings и stoplist. Экран настроек читает данные через frontend API-клиент: в Tauri runtime из SQLite, в браузере через fallback на мок-данные.

Добавлен первый слой нативного трекинга: Tauri-команды запуска, остановки и статуса, polling активного окна Windows, определение имени процесса и заголовка окна, базовый учет простоя после 10 минут без ввода, запись завершенных активных и idle-интервалов в SQLite. В боковой панели есть кнопка запуска и остановки трекинга, live-статус текущей активности и счетчик времени без ввода; в browser preview они работают через мок-режим.

Главный экран и история читают `activity_log` и `idle_log` через frontend API: дневной таймлайн, активное время, простой, недельная история и heatmap строятся из реальных записей SQLite. До подключения LLM активности временно группируются по приложениям как `Сырые активности`.

Для неуточненных idle-интервалов на главном экране показывается модалка: простой можно описать короткой заметкой или игнорировать.

Основная frontend-структура:

- `src/pages/` - экраны приложения.
- `src/components/app/` - каркас приложения и навигация.
- `src/components/dashboard/` - виджеты метрик, таймлайнов, потоков и heatmap.
- `src/data/mock.ts` - мок-данные для browser preview и будущих UI-сценариев.
- `src/lib/activity-analytics.ts` - frontend-агрегация activity log для экранов сегодня и истории.
- `src/lib/focusflow-api.ts` - frontend API-клиент для Tauri-команд и browser fallback.
- `src/types.ts` - общие frontend-типы.
