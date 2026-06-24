import type { ActivityLogRecord, IdleLogRecord } from "@/lib/focusflow-api"
import { requestOllamaGenerate } from "@/lib/tauri-api"
import type { FlowStreamActivity, FlowSummary } from "@/types"

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

export type LlmProviderSettings = {
  provider: "ollama"
  ollamaUrl: string
  model: string
}

export type LlmSummaryGroup = {
  stream_name: string
  flow_name: string
  activities: number[]
}

type OllamaGenerateResponse = {
  response?: string
  error?: string
}

const LLM_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stream_name: { type: "string" },
          flow_name: {
            type: "string",
            enum: ["Work", "Learning", "Communication", "Entertainment", "Routine"],
          },
          activities: {
            type: "array",
            items: { type: "integer" },
          },
        },
        required: ["stream_name", "flow_name", "activities"],
      },
    },
  },
  required: ["tasks"],
} as const

export const DEFAULT_LLM_SETTINGS: LlmProviderSettings = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  model: "qwen2.5:7b-instruct",
}

const FLOW_ACCENTS: Record<string, string> = {
  Работа: "#22C55E",
  Обучение: "#38BDF8",
  Общение: "#A855F7",
  Развлечения: "#F97316",
  Рутина: "#F59E0B",
}

const FLOW_NAME_MAP: Record<string, string> = {
  Work: "Работа",
  Learning: "Обучение",
  Communication: "Общение",
  Entertainment: "Развлечения",
  Routine: "Рутина",
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

export function buildLlmCacheSignature(
  payload: LlmSummaryPayload,
  settings: LlmProviderSettings,
) {
  return JSON.stringify({
    version: 1,
    date: payload.date,
    provider: settings.provider,
    model: settings.model,
    items: payload.items.map((item) => ({
      index: item.index,
      kind: item.kind,
      app: item.app,
      title: item.title,
      url: item.url,
      note: item.note,
      start_time: item.start_time,
      end_time: item.end_time,
      duration_minutes: item.duration_minutes,
    })),
  })
}

export function serializeLlmGroups(groups: LlmSummaryGroup[]) {
  return JSON.stringify(groups)
}

export function parseStoredLlmGroups(value: string) {
  return parseLlmGroups(value)
}

export async function requestOllamaSummary(
  payload: LlmSummaryPayload,
  settings: LlmProviderSettings,
): Promise<LlmSummaryGroup[]> {
  if (payload.items.length === 0) {
    return []
  }

  let data: OllamaGenerateResponse

  if (isTauriRuntime()) {
    data = await requestOllamaGenerate({
      baseUrl: normalizeOllamaUrl(settings.ollamaUrl),
      model: settings.model,
      prompt: buildLlmPrompt(payload),
      format: LLM_RESPONSE_SCHEMA,
    })
  } else {
    const response = await fetch(`${normalizeOllamaUrl(settings.ollamaUrl)}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        prompt: buildLlmPrompt(payload),
        stream: false,
        format: LLM_RESPONSE_SCHEMA,
        options: {
          temperature: 0,
        },
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(details || `Ollama returned HTTP ${response.status}`)
    }

    data = (await response.json()) as OllamaGenerateResponse
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return parseLlmGroups(data.response ?? "")
}

export function buildFlowsFromLlmGroups(
  payload: LlmSummaryPayload,
  groups: LlmSummaryGroup[],
): FlowSummary[] {
  const itemsByIndex = new Map(payload.items.map((item) => [item.index, item]))
  const flows = new Map<
    string,
    Map<string, { minutes: number; activities: number; details: FlowStreamActivity[] }>
  >()
  const usedIndexes = new Set<number>()

  for (const group of groups) {
    const flowName = group.flow_name.trim() || "Рутина"
    const streamName = group.stream_name.trim() || "Без названия"
    const flow =
      flows.get(flowName) ??
      new Map<string, { minutes: number; activities: number; details: FlowStreamActivity[] }>()
    const stream = flow.get(streamName) ?? { minutes: 0, activities: 0, details: [] }

    for (const index of group.activities) {
      const item = itemsByIndex.get(index)

      if (!item || usedIndexes.has(index)) {
        continue
      }

      stream.minutes += item.duration_minutes
      stream.activities += 1
      stream.details.push(toFlowStreamActivity(item))
      usedIndexes.add(index)
    }

    if (stream.activities > 0) {
      flow.set(streamName, stream)
      flows.set(flowName, flow)
    }
  }

  const missedItems = payload.items.filter((item) => !usedIndexes.has(item.index))
  if (missedItems.length > 0) {
    const flow =
      flows.get("Рутина") ??
      new Map<string, { minutes: number; activities: number; details: FlowStreamActivity[] }>()
    const stream = flow.get("Не распознано") ?? {
      minutes: 0,
      activities: 0,
      details: [],
    }

    for (const item of missedItems) {
      stream.minutes += item.duration_minutes
      stream.activities += 1
      stream.details.push(toFlowStreamActivity(item))
    }

    flow.set("Не распознано", stream)
    flows.set("Рутина", flow)
  }

  return [...flows.entries()]
    .map(([flowName, streams]) => {
      const streamItems = [...streams.entries()]
        .map(([streamName, data]) => ({
          name: streamName,
          time: formatMinutes(data.minutes),
          activities: data.activities,
          details: data.details,
        }))
        .sort((left, right) => parseDurationText(right.time) - parseDurationText(left.time))
      const minutes = [...streams.values()].reduce((sum, stream) => sum + stream.minutes, 0)

      return {
        name: flowName,
        time: formatMinutes(minutes),
        accent: FLOW_ACCENTS[flowName] ?? "#71717A",
        streams: streamItems,
      }
    })
    .sort((left, right) => parseDurationText(right.time) - parseDurationText(left.time))
}

export function readLlmSettings(
  settings: { key: string; value: string }[],
): LlmProviderSettings {
  const ollamaUrl = settingValue(settings, "ollama_url", DEFAULT_LLM_SETTINGS.ollamaUrl)
  const model = settingValue(settings, "llm_model", DEFAULT_LLM_SETTINGS.model)

  return {
    provider: "ollama",
    ollamaUrl,
    model,
  }
}

function toFlowStreamActivity(item: LlmSummaryItem): FlowStreamActivity {
  return {
    app: item.app,
    label: item.title || item.note || item.url || item.app,
    start: formatClock(item.start_time),
    end: formatClock(item.end_time),
    duration: formatMinutes(item.duration_minutes),
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

function formatClock(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function buildLlmPrompt(payload: LlmSummaryPayload) {
  const compactItems = payload.items.map((item) => ({
    index: item.index,
    kind: item.kind,
    app: item.app,
    title: item.title,
    url: item.url,
    note: item.note,
    start_time: item.start_time,
    end_time: item.end_time,
    duration_minutes: item.duration_minutes,
  }))

  return `You are a productivity assistant. Group the user's activity log into concrete tasks or projects.

Return only JSON that matches the provided schema. Do not use markdown. Do not explain.

Rules:
- Put groups into the "tasks" array.
- "activities" must contain only numeric indexes from the input.
- Do not leave a group with an empty "activities" array.
- Do not invent activity indexes.
- Use exactly one flow_name value: Work, Learning, Communication, Entertainment, Routine.
- Use concise stream_name values. Russian stream names are allowed when the input is Russian.
- Treat idle items with a note as normal user activity.
- Put idle items without a note into Routine.

Input:
${JSON.stringify(compactItems, null, 2)}`
}

function parseLlmGroups(rawResponse: string): LlmSummaryGroup[] {
  const jsonText = extractJson(rawResponse)
  const parsed = JSON.parse(jsonText) as unknown
  const groups = Array.isArray(parsed) ? parsed : pickGroupsArray(parsed)

  if (!groups) {
    throw new Error("LLM вернула не JSON-массив")
  }

  return groups
    .map((item) => normalizeGroup(item))
    .filter((item): item is LlmSummaryGroup => item !== null)
}

function pickGroupsArray(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const record = value as Record<string, unknown>
  const candidates = [record.tasks, record.groups, record.streams, record.result, record.data]
  return candidates.find(Array.isArray) ?? null
}

function normalizeGroup(value: unknown): LlmSummaryGroup | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value as Record<string, unknown>
  const streamName = typeof item.stream_name === "string" ? item.stream_name.trim() : ""
  const rawFlowName = typeof item.flow_name === "string" ? item.flow_name.trim() : ""
  const flowName = FLOW_NAME_MAP[rawFlowName] ?? rawFlowName
  const activities = Array.isArray(item.activities)
    ? item.activities.filter((index): index is number => Number.isInteger(index) && index >= 0)
    : []

  if (!streamName || !flowName || activities.length === 0) {
    return null
  }

  return {
    stream_name: streamName,
    flow_name: flowName,
    activities,
  }
}

function extractJson(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  const arrayStart = trimmed.indexOf("[")
  const arrayEnd = trimmed.lastIndexOf("]")
  const objectStart = trimmed.indexOf("{")
  const objectEnd = trimmed.lastIndexOf("}")

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1)
  }

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1)
  }

  throw new Error("LLM не вернула JSON с группировкой")
}

function normalizeOllamaUrl(value: string) {
  const trimmed = value.trim() || DEFAULT_LLM_SETTINGS.ollamaUrl
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withProtocol.replace(/\/+$/, "")
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window
}

function settingValue(settings: { key: string; value: string }[], key: string, fallback: string) {
  return settings.find((setting) => setting.key === key)?.value.trim() || fallback
}

function formatMinutes(totalMinutes: number) {
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

function parseDurationText(value: string) {
  const hoursMatch = value.match(/(\d+)\s*ч/)
  const minutesMatch = value.match(/(\d+)\s*мин/)
  return Number(hoursMatch?.[1] ?? 0) * 60 + Number(minutesMatch?.[1] ?? 0)
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
