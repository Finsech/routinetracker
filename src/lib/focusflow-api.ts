import { invoke } from "@tauri-apps/api/core"

import { timeline } from "@/data/mock"

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

export type LlmSummaryRecord = {
  id: number
  date_key: string
  payload_signature: string
  provider: string
  model: string
  groups_json: string
  created_at: string
}

export type LlmSummaryLookup = Pick<
  LlmSummaryRecord,
  "date_key" | "payload_signature" | "provider" | "model"
>

export type SaveLlmSummaryInput = Omit<LlmSummaryRecord, "id" | "created_at">

export type TrackerStatusRecord = {
  running: boolean
  current_app: string | null
  current_window_title: string | null
  idle_seconds: number
}

let browserTrackerRunning = false
let browserStoplist: StoplistItemRecord[] | null = null
let browserIdleLogs: IdleLogRecord[] | null = null
let browserSettings: SettingEntryRecord[] | null = null
let browserLlmSummaries: LlmSummaryRecord[] = []

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
    return getBrowserIdleLogs()
  }

  return invoke<IdleLogRecord[]>("get_idle_logs")
}

export async function createIdleLog(input: NewIdleLogRecord) {
  return invoke<IdleLogRecord>("create_idle_log", { input })
}

export async function updateIdleLog(id: number, input: UpdateIdleLogRecord) {
  if (!isTauriRuntime()) {
    const logs = getBrowserIdleLogs()
    const updatedLog = logs.find((log) => log.id === id)

    if (!updatedLog) {
      throw new Error("Idle log not found")
    }

    Object.assign(updatedLog, input)
    browserIdleLogs = logs.map((log) => (log.id === id ? updatedLog : log))
    return updatedLog
  }

  return invoke<IdleLogRecord>("update_idle_log", { id, input })
}

export async function getSettings() {
  if (!isTauriRuntime()) {
    return getBrowserSettings()
  }

  return invoke<SettingEntryRecord[]>("get_settings")
}

export async function setSetting(key: string, value: string) {
  if (!isTauriRuntime()) {
    browserSettings = getBrowserSettings().map((setting) =>
      setting.key === key ? { ...setting, value } : setting,
    )

    if (!browserSettings.some((setting) => setting.key === key)) {
      browserSettings.push({ key, value })
    }

    return
  }

  return invoke<void>("set_setting", { key, value })
}

export async function getStoplist() {
  if (!isTauriRuntime()) {
    return getBrowserStoplist()
  }

  return invoke<StoplistItemRecord[]>("get_stoplist")
}

export async function addStoplistItem(input: NewStoplistItemRecord) {
  if (!isTauriRuntime()) {
    const nextItem = {
      ...input,
      id: Math.max(0, ...getBrowserStoplist().map((item) => item.id)) + 1,
    }
    browserStoplist = [...getBrowserStoplist(), nextItem]
    return nextItem
  }

  return invoke<StoplistItemRecord>("add_stoplist_item", { input })
}

export async function removeStoplistItem(id: number) {
  if (!isTauriRuntime()) {
    browserStoplist = getBrowserStoplist().filter((item) => item.id !== id)
    return
  }

  return invoke<void>("remove_stoplist_item", { id })
}

export async function getLlmSummary(input: LlmSummaryLookup) {
  if (!isTauriRuntime()) {
    return (
      browserLlmSummaries.find(
        (summary) =>
          summary.date_key === input.date_key &&
          summary.payload_signature === input.payload_signature &&
          summary.provider === input.provider &&
          summary.model === input.model,
      ) ?? null
    )
  }

  return invoke<LlmSummaryRecord | null>("get_llm_summary", input)
}

export async function saveLlmSummary(input: SaveLlmSummaryInput) {
  if (!isTauriRuntime()) {
    const existing = browserLlmSummaries.find(
      (summary) =>
        summary.date_key === input.date_key &&
        summary.payload_signature === input.payload_signature &&
        summary.provider === input.provider &&
        summary.model === input.model,
    )

    const nextSummary = {
      ...input,
      id: existing?.id ?? Math.max(0, ...browserLlmSummaries.map((summary) => summary.id)) + 1,
      created_at: new Date().toISOString(),
    }

    browserLlmSummaries = [
      ...browserLlmSummaries.filter((summary) => summary.id !== nextSummary.id),
      nextSummary,
    ]

    return nextSummary
  }

  return invoke<LlmSummaryRecord>("save_llm_summary", { input })
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

function getBrowserStoplist() {
  if (!browserStoplist) {
    browserStoplist = []
  }

  return browserStoplist
}

function getBrowserIdleLogs() {
  if (!browserIdleLogs) {
    const dateKey = mockDateKey()

    browserIdleLogs = [
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

  return browserIdleLogs
}

function getBrowserSettings() {
  if (!browserSettings) {
    browserSettings = [
      { key: "language", value: "Русский" },
      { key: "theme", value: "Системная" },
      { key: "autostart", value: "Выключен" },
      { key: "llm_provider", value: "ollama" },
      { key: "ollama_url", value: "http://localhost:11434" },
      { key: "llm_model", value: "qwen2.5:7b-instruct" },
      { key: "export_format", value: "JSON" },
    ]
  }

  return browserSettings
}

function mockEndTime(dateKey: string, start: string, index: number) {
  const durationMinutes = [45, 90, 30, 50, 70, 35][index] ?? 30
  const date = new Date(`${dateKey}T${start}:00`)
  date.setMinutes(date.getMinutes() + durationMinutes)
  return date.toISOString()
}
