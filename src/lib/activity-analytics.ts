import type { ActivityLogRecord, IdleLogRecord } from "@/lib/focusflow-api"
import type {
  FlowSummary,
  HeatmapCell,
  HeatmapMonthLabel,
  TimelineItem,
  WeekActivity,
  WeekTimelineDay,
} from "@/types"

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const RAW_FLOW_NAME = "Сырые активности"
const IDLE_FLOW_NAME = "Простой"
const FLOW_ACCENTS: Record<string, string> = {
  [RAW_FLOW_NAME]: "#6EA88F",
  [IDLE_FLOW_NAME]: "#D9A66C",
}
const APP_ACCENTS: Array<{ match: RegExp; color: string }> = [
  { match: /code|cursor|visual studio|vscode/i, color: "#68A67B" },
  { match: /notion/i, color: "#7C8F66" },
  { match: /browser|chrome|edge|firefox|opera/i, color: "#7FA8D8" },
  { match: /figma/i, color: "#B792D9" },
  { match: /slack|telegram|discord|gmail|mail|outlook/i, color: "#E3A36C" },
]

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
  weekDays: WeekTimelineDay[]
  totalHours: number
  heatmap: HeatmapCell[]
  heatmapMonths: HeatmapMonthLabel[]
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
    ].sort((left, right) => left.startMinutes - right.startMinutes),
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
    weekDays: buildWeekTimelineDays(logs, idleLogs, date),
    totalHours,
    ...buildYearHeatmap(logs, idleLogs, date),
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

  const appMap = new Map<
    string,
    { minutes: number; activities: number; details: FlowSummary["streams"][number]["details"] }
  >()

  for (const log of logs) {
    const entry = appMap.get(log.app_name) ?? { minutes: 0, activities: 0, details: [] }
    entry.minutes += durationMinutes(log)
    entry.activities += 1
    entry.details?.push(toFlowStreamActivity(log))
    appMap.set(log.app_name, entry)
  }

  const streams = [...appMap.entries()]
    .sort((left, right) => right[1].minutes - left[1].minutes)
    .map(([appName, data]) => ({
      name: appName,
      time: formatMinutes(data.minutes),
      activities: data.activities,
      details: data.details,
    }))

  return [
    {
      name: RAW_FLOW_NAME,
      time: formatMinutes(logs.reduce((sum, log) => sum + durationMinutes(log), 0)),
      accent: FLOW_ACCENTS[RAW_FLOW_NAME],
      streams,
    },
  ]
}

function buildWeekTimelineDays(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[],
  date: Date,
): WeekTimelineDay[] {
  const weekStart = startOfWeekMonday(date)

  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + offset)
    const items = [
      ...logs
        .filter((log) => isSameDay(new Date(log.start_time), day))
        .sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))
        .map(toTimelineItem),
      ...idleLogs
        .filter((log) => !log.ignored && isSameDay(new Date(log.start_time), day))
        .sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))
        .map(toIdleTimelineItem),
    ].sort((left, right) => left.startMinutes - right.startMinutes)

    return {
      dateKey: formatDateKey(day),
      label: formatDayLabel(day),
      shortLabel: WEEKDAY_SHORT[offset],
      dayNumber: String(day.getDate()),
      totalMinutes: items.reduce((sum, item) => sum + item.durationMinutes, 0),
      items,
    }
  })
}

function buildYearHeatmap(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[],
  date: Date,
): Pick<HistoryActivitySummary, "heatmap" | "heatmapMonths"> {
  const endDate = new Date(date)
  endDate.setHours(0, 0, 0, 0)

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 364)

  const gridStart = startOfWeekSunday(startDate)
  const gridEnd = endOfWeekSaturday(endDate)
  const dailyMinutes = buildDailyMinuteMap(logs, idleLogs)
  const heatmap: HeatmapCell[] = []
  const heatmapMonths: HeatmapMonthLabel[] = []
  const seenMonths = new Set<string>()

  let cursor = new Date(gridStart)

  while (cursor <= gridEnd) {
    const weekIndex = diffDays(gridStart, cursor) / 7
    const weekday = cursor.getDay()
    const dateKey = formatDateKey(cursor)
    const totalMinutes = dailyMinutes.get(dateKey) ?? 0

    heatmap.push({
      dateKey,
      level: heatLevel(totalMinutes),
      totalMinutes,
      weekIndex,
      weekday,
    })

    const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`
    if (cursor.getDate() <= 7 && !seenMonths.has(monthKey)) {
      heatmapMonths.push({
        label: cursor.toLocaleString("ru-RU", { month: "short" }).replace(".", ""),
        weekIndex,
      })
      seenMonths.add(monthKey)
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return { heatmap, heatmapMonths }
}

function buildDailyMinuteMap(logs: ActivityLogRecord[], idleLogs: IdleLogRecord[]) {
  const map = new Map<string, number>()

  for (const log of logs) {
    const key = formatDateKey(new Date(log.start_time))
    map.set(key, (map.get(key) ?? 0) + durationMinutes(log))
  }

  for (const log of idleLogs) {
    if (log.ignored) {
      continue
    }

    const key = formatDateKey(new Date(log.start_time))
    map.set(key, (map.get(key) ?? 0) + durationMinutes(log))
  }

  return map
}

function toTimelineItem(log: ActivityLogRecord): TimelineItem {
  const minutes = durationMinutes(log)
  const accent = accentForActivity(log)

  return {
    start: formatClock(log.start_time),
    end: formatClock(log.end_time),
    label: log.window_title || log.url || log.app_name,
    app: log.app_name,
    flow: RAW_FLOW_NAME,
    accent,
    durationMinutes: minutes,
    startMinutes: minutesSinceMidnight(log.start_time),
    endMinutes: minutesSinceMidnight(log.end_time),
    kind: "activity",
    url: log.url,
  }
}

function toIdleTimelineItem(log: IdleLogRecord): TimelineItem {
  const minutes = durationMinutes(log)

  return {
    start: formatClock(log.start_time),
    end: formatClock(log.end_time),
    label: log.note || IDLE_FLOW_NAME,
    app: "Idle",
    flow: IDLE_FLOW_NAME,
    accent: FLOW_ACCENTS[IDLE_FLOW_NAME],
    durationMinutes: minutes,
    startMinutes: minutesSinceMidnight(log.start_time),
    endMinutes: minutesSinceMidnight(log.end_time),
    kind: "idle",
    url: null,
  }
}

function accentForActivity(log: ActivityLogRecord) {
  const haystack = `${log.app_name} ${log.window_title ?? ""} ${log.url ?? ""}`
  return APP_ACCENTS.find((entry) => entry.match.test(haystack))?.color ?? FLOW_ACCENTS[RAW_FLOW_NAME]
}

function toFlowStreamActivity(log: ActivityLogRecord) {
  const minutes = durationMinutes(log)

  return {
    app: log.app_name,
    label: log.window_title || log.url || log.app_name,
    start: formatClock(log.start_time),
    end: formatClock(log.end_time),
    duration: formatMinutes(minutes),
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

function timeValue(value: string) {
  return new Date(value).getTime()
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function minutesSinceMidnight(value: string) {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function buildLastSevenDays(date: Date) {
  const weekStart = startOfWeekMonday(date)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    day.setHours(0, 0, 0, 0)
    return day
  })
}

function heatLevel(totalMinutes: number) {
  if (totalMinutes <= 0) return 0
  if (totalMinutes < 60) return 1
  if (totalMinutes < 180) return 2
  if (totalMinutes < 300) return 3
  if (totalMinutes < 420) return 4
  return 5
}

function startOfWeekMonday(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  return result
}

function startOfWeekSunday(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function endOfWeekSaturday(date: Date) {
  const result = startOfWeekSunday(date)
  result.setDate(result.getDate() + 6)
  return result
}

function diffDays(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "")
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}
