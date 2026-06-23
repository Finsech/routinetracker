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

export type IdleLogRecord = {
  id: number
  start_time: string
  end_time: string
  note: string | null
  ignored: boolean
  reviewed: boolean
}

export type NewIdleLogRecord = Omit<IdleLogRecord, "id" | "reviewed">
export type UpdateIdleLogRecord = Pick<IdleLogRecord, "note" | "ignored" | "reviewed">

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
  current_app: string | null
  current_window_title: string | null
  idle_seconds: number
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

export async function getIdleLogs() {
  if (!isTauriRuntime()) {
    const dateKey = mockDateKey()

    return [
      {
        id: 1,
        start_time: `${dateKey}T12:00:00`,
        end_time: `${dateKey}T12:30:00`,
        note: null,
        ignored: false,
        reviewed: false,
      },
    ]
  }

  return invoke<IdleLogRecord[]>("get_idle_logs")
}

export async function createIdleLog(input: NewIdleLogRecord) {
  return invoke<IdleLogRecord>("create_idle_log", { input })
}

export async function updateIdleLog(id: number, input: UpdateIdleLogRecord) {
  return invoke<IdleLogRecord>("update_idle_log", { id, input })
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
    return {
      running: browserTrackerRunning,
      current_app: browserTrackerRunning ? "browser-preview" : null,
      current_window_title: browserTrackerRunning ? "Мок-режим трекинга" : null,
      idle_seconds: 0,
    }
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
