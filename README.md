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

На Rust-стороне добавлен SQLite-слой с миграциями и Tauri-командами для activity log, settings и stoplist. На frontend-стороне есть API-клиент с fallback на мок-данные для браузерного preview.

Основная frontend-структура:

- `src/pages/` - экраны приложения.
- `src/components/app/` - каркас приложения и навигация.
- `src/components/dashboard/` - виджеты метрик, таймлайнов, потоков и heatmap.
- `src/data/mock.ts` - мок-данные до подключения SQLite и трекинга.
- `src/lib/focusflow-api.ts` - frontend API-клиент для Tauri-команд и browser fallback.
- `src/types.ts` - общие frontend-типы.
