import type { LucideIcon } from "lucide-react"

export type View = "today" | "week" | "analytics" | "settings"

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
  label: string
  value: string
}
