import type { ActivityLogRecord, IdleLogRecord } from "@/lib/focusflow-api"

type TimeRangeRecord = {
  start_time: string
  end_time: string
}

export type LlmSummaryItem = {
  index: number
  kind: "activity" | "idle"
  app: string
  title: string | null
  url: string | null
  note: string | null
  start_time: string
  end_time: string
  duration_minutes: number
}

export type LlmSummaryPayload = {
  date: string
  locale: "ru-RU"
  activity_count: number
  idle_count: number
  total_active_minutes: number
  total_idle_minutes: number
  items: LlmSummaryItem[]
}

export function buildLlmSummaryPayload(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[],
  date = new Date(),
): LlmSummaryPayload {
  const activeItems = logs
    .filter((log) => isSameDay(new Date(log.start_time), date))
    .map((log) => ({
      app: log.app_name,
      end_time: log.end_time,
      kind: "activity" as const,
      note: null,
      start_time: log.start_time,
      title: log.window_title,
      url: log.url,
      duration_minutes: roundMinutes(durationMinutes(log)),
    }))
  const idleItems = idleLogs
    .filter((log) => !log.ignored && isSameDay(new Date(log.start_time), date))
    .map((log) => ({
      app: "Idle",
      end_time: log.end_time,
      kind: "idle" as const,
      note: log.note,
      start_time: log.start_time,
      title: log.note || "Простой",
      url: null,
      duration_minutes: roundMinutes(durationMinutes(log)),
    }))
  const items = [...activeItems, ...idleItems]
    .sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))
    .map((item, index) => ({ ...item, index }))

  return {
    date: formatDateKey(date),
    locale: "ru-RU",
    activity_count: activeItems.length,
    idle_count: idleItems.length,
    total_active_minutes: roundMinutes(
      activeItems.reduce((sum, item) => sum + item.duration_minutes, 0),
    ),
    total_idle_minutes: roundMinutes(
      idleItems.reduce((sum, item) => sum + item.duration_minutes, 0),
    ),
    items,
  }
}

export function stringifyLlmPayload(payload: LlmSummaryPayload) {
  return JSON.stringify(payload, null, 2)
}

function durationMinutes(log: TimeRangeRecord) {
  const start = timeValue(log.start_time)
  const end = timeValue(log.end_time)

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return (end - start) / 60_000
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function roundMinutes(value: number) {
  return Math.round(value * 10) / 10
}

function timeValue(value: string) {
  return new Date(value).getTime()
}
