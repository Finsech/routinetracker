import type { FlowSummary, SettingRow, TimelineItem, WeekActivity } from "@/types"
import { FLOW_LABELS } from "@/lib/copy/ru"
import { buildDefaultSettingRows } from "@/lib/settings-contract"

export const flows: FlowSummary[] = [
  {
    id: "work",
    name: FLOW_LABELS.work,
    time: "4 ч 35 мин",
    accent: "#7CB39A",
    streams: [
      { name: "Разработка FocusFlow", time: "2 ч 45 мин", activities: 8 },
      { name: "Подготовка спецификации", time: "1 ч 10 мин", activities: 4 },
      { name: "Рабочая коммуникация", time: "40 мин", activities: 5 },
    ],
  },
  {
    id: "learning",
    name: FLOW_LABELS.learning,
    time: "1 ч 20 мин",
    accent: "#86B8E5",
    streams: [
      { name: "Документация Tauri", time: "45 мин", activities: 3 },
      { name: "Примеры SQLite", time: "35 мин", activities: 2 },
    ],
  },
  {
    id: "misc",
    name: FLOW_LABELS.misc,
    time: "35 мин",
    accent: "#F2B880",
    streams: [{ name: "Почта и календарь", time: "35 мин", activities: 6 }],
  },
]

export const timeline: TimelineItem[] = [
  buildTimelineItem("09:00", "09:40", "Планирование дня", "Notion", "work", "#7CB39A"),
  buildTimelineItem("10:00", "11:35", "Разработка FocusFlow", "Code", "work", "#7CB39A"),
  buildTimelineItem("12:00", "12:30", "Перерыв", "Idle", "idle", "#D9A66C", "idle"),
  buildTimelineItem("13:00", "13:50", "Документация Tauri", "Browser", "learning", "#86B8E5"),
  buildTimelineItem("14:00", "15:10", "LLM-саммаризация", "Code", "work", "#7CB39A"),
  buildTimelineItem("16:00", "16:35", "Почта и календарь", "Browser", "misc", "#F2B880"),
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

export const settingsRows: SettingRow[] = buildDefaultSettingRows()

function buildTimelineItem(
  start: string,
  end: string,
  label: string,
  app: string,
  flowId: TimelineItem["flowId"],
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
    flowId,
    flow: FLOW_LABELS[flowId],
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
