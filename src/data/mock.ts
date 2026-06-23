import type { FlowSummary, SettingRow, TimelineItem, WeekActivity } from "@/types"

export const flows: FlowSummary[] = [
  {
    name: "Работа",
    time: "4 ч 35 мин",
    accent: "#7CB39A",
    streams: [
      { name: "Разработка FocusFlow", time: "2 ч 45 мин", activities: 8 },
      { name: "Подготовка спецификации", time: "1 ч 10 мин", activities: 4 },
      { name: "Рабочая коммуникация", time: "40 мин", activities: 5 },
    ],
  },
  {
    name: "Обучение",
    time: "1 ч 20 мин",
    accent: "#86B8E5",
    streams: [
      { name: "Документация Tauri", time: "45 мин", activities: 3 },
      { name: "Примеры SQLite", time: "35 мин", activities: 2 },
    ],
  },
  {
    name: "Рутина",
    time: "35 мин",
    accent: "#F2B880",
    streams: [{ name: "Почта и календарь", time: "35 мин", activities: 6 }],
  },
]

export const timeline: TimelineItem[] = [
  buildTimelineItem("09:00", "09:40", "Планирование дня", "Notion", "Работа", "#7CB39A"),
  buildTimelineItem("10:00", "11:35", "Разработка FocusFlow", "Code", "Работа", "#7CB39A"),
  buildTimelineItem("12:00", "12:30", "Перерыв", "Idle", "Простой", "#D9A66C", "idle"),
  buildTimelineItem("13:00", "13:50", "Документация Tauri", "Browser", "Обучение", "#86B8E5"),
  buildTimelineItem("14:00", "15:10", "LLM-саммаризация", "Code", "Работа", "#7CB39A"),
  buildTimelineItem("16:00", "16:35", "Почта и календарь", "Browser", "Рутина", "#F2B880"),
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
  { label: "LLM-модель", value: "qwen2.5:7b-instruct" },
  { label: "Экспорт", value: "JSON" },
]

function buildTimelineItem(
  start: string,
  end: string,
  label: string,
  app: string,
  flow: string,
  accent: string,
  kind: "activity" | "idle" = "activity",
): TimelineItem {
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)

  return {
    start,
    end,
    label,
    app,
    flow,
    accent,
    durationMinutes: endMinutes - startMinutes,
    startMinutes,
    endMinutes,
    kind,
    url: null,
  }
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}
