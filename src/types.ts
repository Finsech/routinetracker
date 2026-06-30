import type { LucideIcon } from "lucide-react"

export type View = "today" | "week" | "analytics" | "settings"

export type FlowId =
  | "raw"
  | "idle"
  | "work"
  | "learning"
  | "communication"
  | "entertainment"
  | "misc"

export type SettingKey =
  | "language"
  | "theme"
  | "autostart"
  | "llm_provider"
  | "ollama_url"
  | "llm_model"
  | "export_format"

export type NavItem = {
  id: View
  label: string
  icon: LucideIcon
}

export type FlowStream = {
  name: string
  time: string
  activities: number
  details?: FlowStreamActivity[]
}

export type FlowStreamActivity = {
  app: string
  label: string
  start: string
  end: string
  duration: string
}

export type FlowSummary = {
  id: FlowId
  name: string
  time: string
  accent: string
  streams: FlowStream[]
}

export type TimelineItem = {
  start: string
  end: string
  label: string
  app: string
  flowId: FlowId
  flow: string
  accent: string
  durationMinutes: number
  startMinutes: number
  endMinutes: number
  kind: "activity" | "idle"
  url?: string | null
}

export type WeekActivity = {
  day: string
  hours: number
}

export type SettingRow = {
  key: SettingKey
  label: string
  value: string
}

export type WeekTimelineDay = {
  dateKey: string
  label: string
  shortLabel: string
  dayNumber: string
  totalMinutes: number
  items: TimelineItem[]
}

export type HeatmapCell = {
  dateKey: string
  level: number
  totalMinutes: number
  weekIndex: number
  weekday: number
}

export type HeatmapMonthLabel = {
  label: string
  weekIndex: number
}
