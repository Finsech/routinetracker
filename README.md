# FocusFlow

**RU:** FocusFlow — локальный desktop-трекер времени, который автоматически собирает активность по окнам и сайтам, а затем превращает шумный трек в понятные **потоки** и **стримы** с помощью локальной LLM.

**EN:** FocusFlow is a local-first desktop time tracker that captures real window and browser activity, then turns noisy logs into human-readable **flows** and **streams** with a local LLM.

## Киллер-фичи / Killer features

- **Локальный first:** SQLite, локальный трек, локальная Ollama, без обязательной отправки данных в облако.
- **Реальный цифровой трек:** активные окна, заголовки, browser URL через локальный bridge.
- **Из шума в смысл:** LLM группирует активность не только по приложениям, а по проектам, задачам и потокам работы.
- **Понятная картина дня и недели:** Dayflow-inspired интерфейс с дневным и недельным таймлайном, heatmap и обзорной аналитикой.
- **Фоновая работа:** приложение живет в системном трее, а не требует постоянного ручного участия.
- **Контроль приватности:** stoplist для приложений и сайтов, экспорт в JSON, локальная база.

## Russian overview

FocusFlow помогает ответить на вопрос не только **сколько времени** ушло за экраном, но и **на что именно** оно ушло.

Приложение:

- автоматически отслеживает активные окна и сайты;
- фиксирует простои;
- показывает таймлайн дня и ритм недели;
- собирает сводку по потокам вроде `Работа`, `Обучение`, `Общение`, `Прочее`;
- раскладывает поток `Работа` на конкретные стримы и проекты;
- умеет жить локально и не тащить трек в облако по умолчанию.

На практике это трекер, который ближе к **анализу реальной работы**, чем к простому таймеру или учету “времени в приложениях”.

## English overview

FocusFlow is built for a more useful question than “how long was the screen on?” — it aims to show **what your time actually went into**.

The app:

- tracks active windows and browser activity automatically;
- detects idle periods;
- renders a day timeline and week rhythm view;
- groups time into higher-level flows such as `Work`, `Learning`, `Communication`, and `Misc`;
- breaks `Work` down into concrete streams and projects;
- keeps the whole pipeline local-first by default.

In practice, it is closer to a **project-aware productivity tracker** than to a basic app usage timer.

## Быстрый старт для пользователя

### Windows

1. Открой страницу [Releases](https://github.com/Finsech/routinetracker/releases).
2. Скачай:
   - `FocusFlow_x64-setup.exe` — если нужен обычный установщик;
   - или `focusflow.exe` — если хочешь просто запустить приложение без установки.
3. Установи или запусти приложение.
4. Для LLM-группировки поставь Ollama по инструкции ниже.

### macOS

1. Открой страницу [Releases](https://github.com/Finsech/routinetracker/releases).
2. Скачай `.dmg` для macOS.
3. Открой `.dmg` и перетащи `FocusFlow.app` в `Applications`.
4. Попробуй открыть приложение.

Если macOS блокирует запуск неподписанного приложения, есть два простых способа:

- **Способ 1:** в `Applications` кликни по `FocusFlow.app` правой кнопкой мыши -> `Open` -> еще раз `Open`.
- **Способ 2:** если macOS все равно блокирует запуск, открой `System Settings` -> `Privacy & Security` -> внизу нажми `Open Anyway`.

Справка Apple:

- https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac
- https://support.apple.com/en-us/102445

## Ollama для FocusFlow

LLM-группировка в FocusFlow работает через локальную Ollama.

### 1. Установить Ollama

- **Windows:** скачай `OllamaSetup.exe` с официальной страницы загрузки.
- **macOS:** скачай `ollama.dmg`, открой его и перетащи Ollama в `Applications`.

Официальные страницы:

- https://ollama.com/download
- https://docs.ollama.com/quickstart

### 2. Запустить Ollama

После установки просто открой приложение Ollama.

На macOS Ollama обычно сама проверяет наличие `ollama` CLI в `PATH` и при необходимости предлагает создать ссылку в `/usr/local/bin`.

### 3. Скачать модель

Рекомендованная модель для текущего MVP:

```bash
ollama pull qwen2.5:7b-instruct
```

Проверить, что модель установилась:

```bash
ollama list
```

### 4. Подключить Ollama к FocusFlow

В `Настройках` FocusFlow укажи:

- **Провайдер:** Ollama
- **URL:** `http://localhost:11434`
- **Модель:** `qwen2.5:7b-instruct`

После этого на экране `Сегодня` можно использовать `Собрать день` / `Обновить группы`.

### Замечание по диску

Модели Ollama могут занимать десятки гигабайт. Если на машине мало свободного места, это лучше проверить заранее.

## Для разработчиков

### Tech stack

- **Framework:** Tauri
- **Backend:** Rust
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS
- **Database:** local SQLite
- **Local AI:** Ollama

### Install dependencies

```bash
npm install
```

### Web preview

```bash
npm run dev
```

### Build frontend

```bash
npm run build
```

### Check Rust/Tauri

```bash
cd src-tauri
cargo check
```

### Run desktop dev mode

```bash
npm run tauri dev
```

### Build desktop app

```bash
npm run tauri build
```

## Documentation

- `SPECIFICATION.md` — product specification
- `ROADMAP.md` — status and implementation order
- `RELEASE_NOTES.md` — current release snapshot
- `MACOS_BUILD.md` — notes for the macOS build and launch path
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

## Known limitations

- browser URL tracking requires the local browser extension from `browser-extension/`;
- LLM grouping quality depends on the locally available Ollama model;
- macOS artifact is currently unsigned;
- full polished macOS distribution still needs signing and notarization.
