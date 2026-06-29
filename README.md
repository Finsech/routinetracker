# FocusFlow

**RU:** FocusFlow — локальный desktop-трекер времени, который автоматически собирает активность по окнам и сайтам, а затем превращает шумный трек в понятные **потоки** и **стримы** с помощью локальной LLM.

**EN:** FocusFlow is a local-first desktop time tracker that captures real window and browser activity, then turns noisy logs into human-readable **flows** and **streams** with a local LLM.

## Киллер-фичи / Killer features

- **Локальный first**: SQLite, локальный трек, локальная Ollama, без обязательной отправки данных в облако.
- **Реальный цифровой трек**: активные окна, заголовки, browser URL через локальный bridge.
- **Из шума в смысл**: LLM группирует активность не только по приложениям, а по проектам, задачам и потокам работы.
- **Понятная картина дня и недели**: Dayflow-inspired интерфейс с дневным и недельным таймлайном, heatmap и обзорной аналитикой.
- **Фоновая работа**: приложение живет в системном трее, а не требует постоянного ручного участия.
- **Контроль приватности**: stoplist для приложений и сайтов, экспорт в JSON, локальная база.

## Russian overview

FocusFlow помогает ответить на вопрос не только **сколько времени** ушло за экраном, но и **на что именно** оно ушло.

Приложение:

- автоматически отслеживает активные окна и сайты;
- фиксирует простои;
- показывает таймлайн дня и ритм недели;
- собирает сводку по потокам вроде `Работа`, `Обучение`, `Общение`, `Рутина`;
- раскладывает поток `Работа` на конкретные стримы и проекты;
- умеет жить локально и не тащить трек в облако по умолчанию.

На практике это трекер, который ближе к **анализу реальной работы**, чем к простому таймеру или учету “времени в приложениях”.

## English overview

FocusFlow is built for a more useful question than “how long was the screen on?” — it aims to show **what your time actually went into**.

The app:

- tracks active windows and browser activity automatically;
- detects idle periods;
- renders a day timeline and week rhythm view;
- groups time into higher-level flows such as `Work`, `Learning`, `Communication`, and `Routine`;
- breaks `Work` down into concrete streams and projects;
- keeps the whole pipeline local-first by default.

In practice, it is closer to a **project-aware productivity tracker** than to a basic app usage timer.

## Tech stack

- **Framework:** Tauri
- **Backend:** Rust
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **Database:** local SQLite
- **Local AI:** Ollama

## Commands

Install dependencies:

```bash
npm install
```

Run web preview:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Check Rust/Tauri:

```bash
cd src-tauri
cargo check
```

Run desktop dev mode:

```bash
npm run tauri dev
```

Build desktop app:

```bash
npm run tauri build
```

## Documentation

- `SPECIFICATION.md` — product specification
- `ROADMAP.md` — status and implementation order
- `RELEASE_NOTES.md` — release snapshot
- `MACOS_BUILD.md` — notes for the first macOS build pass
- `AGENTS.md` — project rules for the AI agent

## Current status

FocusFlow already has a working desktop MVP:

- native activity tracking on Windows;
- local SQLite storage;
- idle review flow;
- browser URL bridge;
- LLM day grouping through Ollama;
- screens `Сегодня`, `Анализ дня`, `Неделя`, `Настройки`;
- JSON export;
- tray-based background behavior.

Windows release artifacts are already produced in:

- `src-tauri/target/release/focusflow.exe`
- `src-tauri/target/release/bundle/msi/FocusFlow_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/FocusFlow_0.1.0_x64-setup.exe`

## Known limitations

- browser URL tracking requires the local browser extension from `browser-extension/`;
- LLM grouping quality depends on the locally available Ollama model;
- full macOS build output requires a macOS host or a macOS CI runner.
