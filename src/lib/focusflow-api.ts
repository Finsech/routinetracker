import { invoke } from "@tauri-apps/api/core"

import { flows, settingsRows, timeline } from "@/data/mock"

export type ActivityLogRecord = {
  id: number
  start_time: string
  end_time: string
  app_name: string
  window_title: string | null
  url: string | null
}

export type NewActivityLogRecord = Omit<ActivityLogRecord, "id">

export type SettingEntryRecord = {
  key: string
  value: string
}

export type StoplistItemRecord = {
  id: number
  item_type: string
  value: string
}

export type NewStoplistItemRecord = Omit<StoplistItemRecord, "id">

export type TrackerStatusRecord = {
  running: boolean
}

let browserTrackerRunning = false

export async function getActivityLogs() {
  if (!isTauriRuntime()) {
    const dateKey = mockDateKey()

    return timeline.map<ActivityLogRecord>((item, index) => ({
      id: index + 1,
      start_time: `${dateKey}T${item.start}:00`,
      end_time: mockEndTime(dateKey, item.start, index),
      app_name: item.app,
      window_title: item.label,
      url: null,
    }))
  }

  return invoke<ActivityLogRecord[]>("get_activity_logs")
}

export async function createActivityLog(input: NewActivityLogRecord) {
  return invoke<ActivityLogRecord>("create_activity_log", { input })
}

export async function getSettings() {
  if (!isTauriRuntime()) {
    return settingsRows.map<SettingEntryRecord>((row) => ({
      key: row.label,
      value: row.value,
    }))
  }

  return invoke<SettingEntryRecord[]>("get_settings")
}

export async function setSetting(key: string, value: string) {
  return invoke<void>("set_setting", { key, value })
}

export async function getStoplist() {
  if (!isTauriRuntime()) {
    return flows.flatMap<StoplistItemRecord>((flow, flowIndex) =>
      flow.streams.slice(0, 1).map((stream, streamIndex) => ({
        id: flowIndex * 10 + streamIndex + 1,
        item_type: "app",
        value: stream.name,
      })),
    )
  }

  return invoke<StoplistItemRecord[]>("get_stoplist")
}

export async function addStoplistItem(input: NewStoplistItemRecord) {
  return invoke<StoplistItemRecord>("add_stoplist_item", { input })
}

export async function removeStoplistItem(id: number) {
  return invoke<void>("remove_stoplist_item", { id })
}

export async function startTracking() {
  if (!isTauriRuntime()) {
    browserTrackerRunning = true
    return
  }

  return invoke<void>("start_tracking")
}

export async function stopTracking() {
  if (!isTauriRuntime()) {
    browserTrackerRunning = false
    return
  }

  return invoke<void>("stop_tracking")
}

export async function getTrackingStatus() {
  if (!isTauriRuntime()) {
    return { running: browserTrackerRunning }
  }

  return invoke<TrackerStatusRecord>("get_tracking_status")
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window
}

function mockDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function mockEndTime(dateKey: string, start: string, index: number) {
  const durationMinutes = [45, 90, 30, 50, 70, 35][index] ?? 30
  const date = new Date(`${dateKey}T${start}:00`)
  date.setMinutes(date.getMinutes() + durationMinutes)
  return date.toISOString()
}
