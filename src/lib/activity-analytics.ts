import type { ActivityLogRecord, IdleLogRecord } from "@/lib/focusflow-api"
import type { FlowSummary, TimelineItem, WeekActivity } from "@/types"

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const RAW_FLOW_NAME = "Сырые активности"

type TimeRangeRecord = {
  start_time: string
  end_time: string
}

export type TodayActivitySummary = {
  timeline: TimelineItem[]
  flows: FlowSummary[]
  focusPercent: string
  activeTime: string
  idleTime: string
  totalMinutes: number
}

export type HistoryActivitySummary = {
  week: WeekActivity[]
  totalHours: number
  heatmapLevels: number[]
}

export function buildTodaySummary(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[] = [],
  date = new Date(),
): TodayActivitySummary {
  const todayLogs = logs
    .filter((log) => isSameDay(new Date(log.start_time), date))
    .sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))
  const todayIdleLogs = idleLogs
    .filter((log) => !log.ignored && isSameDay(new Date(log.start_time), date))
    .sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))

  const totalMinutes = todayLogs.reduce((sum, log) => sum + durationMinutes(log), 0)
  const idleMinutes = todayIdleLogs.reduce((sum, log) => sum + durationMinutes(log), 0)
  const trackedMinutes = totalMinutes + idleMinutes

  return {
    timeline: [
      ...todayLogs.map(toTimelineItem),
      ...todayIdleLogs.map(toIdleTimelineItem),
    ].sort((left, right) => clockSortValue(left.start) - clockSortValue(right.start)),
    flows: buildAppFlows(todayLogs),
    focusPercent: trackedMinutes > 0 ? `${Math.round((totalMinutes / trackedMinutes) * 100)}%` : "0%",
    activeTime: formatMinutes(totalMinutes),
    idleTime: formatMinutes(idleMinutes),
    totalMinutes,
  }
}

export function buildHistorySummary(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[] = [],
  date = new Date(),
): HistoryActivitySummary {
  const days = buildLastSevenDays(date)
  const week = days.map((day) => {
    const activeMinutes = logs
      .filter((log) => isSameDay(new Date(log.start_time), day))
      .reduce((sum, log) => sum + durationMinutes(log), 0)
    const idleMinutes = idleLogs
      .filter((log) => !log.ignored && isSameDay(new Date(log.start_time), day))
      .reduce((sum, log) => sum + durationMinutes(log), 0)

    return {
      day: DAY_LABELS[day.getDay()],
      hours: (activeMinutes + idleMinutes) / 60,
    }
  })

  const totalHours = week.reduce((sum, item) => sum + item.hours, 0)

  return {
    week,
    totalHours,
    heatmapLevels: week.flatMap((item) => buildDayHeatCells(item.hours)),
  }
}

export function formatMinutes(totalMinutes: number) {
  const rounded = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (hours === 0) {
    return `${minutes} мин`
  }

  if (minutes === 0) {
    return `${hours} ч`
  }

  return `${hours} ч ${minutes} мин`
}

function buildAppFlows(logs: ActivityLogRecord[]): FlowSummary[] {
  if (logs.length === 0) {
    return []
  }

  const appMap = new Map<string, { minutes: number; activities: number }>()

  for (const log of logs) {
    const entry = appMap.get(log.app_name) ?? { minutes: 0, activities: 0 }
    entry.minutes += durationMinutes(log)
    entry.activities += 1
    appMap.set(log.app_name, entry)
  }

  const streams = [...appMap.entries()]
    .sort((left, right) => right[1].minutes - left[1].minutes)
    .map(([appName, data]) => ({
      name: appName,
      time: formatMinutes(data.minutes),
      activities: data.activities,
    }))

  return [
    {
      name: RAW_FLOW_NAME,
      time: formatMinutes(logs.reduce((sum, log) => sum + durationMinutes(log), 0)),
      accent: "#22C55E",
      streams,
    },
  ]
}

function toTimelineItem(log: ActivityLogRecord): TimelineItem {
  const minutes = durationMinutes(log)

  return {
    start: formatClock(log.start_time),
    label: log.window_title || log.url || log.app_name,
    app: log.app_name,
    flow: RAW_FLOW_NAME,
    size: heightClass(minutes),
  }
}

function toIdleTimelineItem(log: IdleLogRecord): TimelineItem {
  const minutes = durationMinutes(log)

  return {
    start: formatClock(log.start_time),
    label: log.note || "Простой",
    app: "Idle",
    flow: "Уточнить",
    size: heightClass(minutes),
  }
}

function durationMinutes(log: TimeRangeRecord) {
  const start = timeValue(log.start_time)
  const end = timeValue(log.end_time)

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return (end - start) / 60_000
}

function clockSortValue(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

function timeValue(value: string) {
  return new Date(value).getTime()
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function heightClass(minutes: number) {
  if (minutes >= 90) return "h-28"
  if (minutes >= 60) return "h-24"
  if (minutes >= 30) return "h-20"
  if (minutes >= 15) return "h-16"
  return "h-12"
}

function buildLastSevenDays(date: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    return day
  })
}

function buildDayHeatCells(hours: number) {
  const level = hoursToLevel(hours)
  return Array.from({ length: 14 }, () => level)
}

function hoursToLevel(hours: number) {
  if (hours >= 6) return 4
  if (hours >= 4) return 3
  if (hours >= 2) return 2
  if (hours > 0) return 1
  return 0
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}
