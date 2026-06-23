import type { FlowSummary, SettingRow, TimelineItem, WeekActivity } from "@/types"

export const flows: FlowSummary[] = [
  {
    name: "Работа",
    time: "4 ч 35 мин",
    accent: "#22C55E",
    streams: [
      { name: "Разработка FocusFlow", time: "2 ч 45 мин", activities: 8 },
      { name: "Подготовка спецификации", time: "1 ч 10 мин", activities: 4 },
      { name: "Рабочая коммуникация", time: "40 мин", activities: 5 },
    ],
  },
  {
    name: "Обучение",
    time: "1 ч 20 мин",
    accent: "#38BDF8",
    streams: [
      { name: "Документация Tauri", time: "45 мин", activities: 3 },
      { name: "Примеры SQLite", time: "35 мин", activities: 2 },
    ],
  },
  {
    name: "Рутина",
    time: "35 мин",
    accent: "#F59E0B",
    streams: [{ name: "Почта и календарь", time: "35 мин", activities: 6 }],
  },
]

export const timeline: TimelineItem[] = [
  { start: "09:00", label: "Планирование дня", app: "Notion", flow: "Работа", size: "h-14" },
  { start: "10:00", label: "Разработка FocusFlow", app: "Code", flow: "Работа", size: "h-24" },
  { start: "12:00", label: "Перерыв", app: "Idle", flow: "Уточнить", size: "h-12" },
  { start: "13:00", label: "Документация Tauri", app: "Browser", flow: "Обучение", size: "h-16" },
  { start: "14:00", label: "LLM-саммаризация", app: "Code", flow: "Работа", size: "h-20" },
  { start: "16:00", label: "Почта и календарь", app: "Browser", flow: "Рутина", size: "h-12" },
]

export const week: WeekActivity[] = [
  { day: "Пн", hours: 6.5 },
  { day: "Вт", hours: 7.2 },
  { day: "Ср", hours: 4.8 },
  { day: "Чт", hours: 5.1 },
  { day: "Пт", hours: 6.0 },
  { day: "Сб", hours: 1.7 },
  { day: "Вс", hours: 0.8 },
]

export const settingsRows: SettingRow[] = [
  { label: "Язык", value: "Русский" },
  { label: "Тема", value: "Системная" },
  { label: "Автозапуск", value: "Выключен" },
  { label: "LLM-провайдер", value: "ollama" },
  { label: "Ollama", value: "http://localhost:11434" },
  { label: "LLM-модель", value: "gpt-oss:20b" },
  { label: "Экспорт", value: "JSON" },
]
