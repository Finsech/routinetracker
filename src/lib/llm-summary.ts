import type { ActivityLogRecord, IdleLogRecord } from "@/lib/focusflow-api"
import { requestOllamaGenerate } from "@/lib/tauri-api"
import type { FlowStreamActivity, FlowSummary } from "@/types"
import {
  buildContextHints,
  isBrowserApp,
  isWorkCandidateApp,
  isWorkCandidateDomain,
  normalizeAppName,
  type FlowHint,
} from "@/lib/context-taxonomy"

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
  domain: string | null
  project_hint?: string | null
  project_key?: string | null
  note: string | null
  start_time: string
  end_time: string
  duration_minutes: number
  episodes?: number
  examples?: string[]
  hint_flow?: FlowHint | null
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

type DraftLlmActivity = Omit<LlmSummaryItem, "index">

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
  "\u0420\u0430\u0431\u043e\u0442\u0430": "#22C55E",
  "\u041e\u0431\u0443\u0447\u0435\u043d\u0438\u0435": "#38BDF8",
  "\u041e\u0431\u0449\u0435\u043d\u0438\u0435": "#A855F7",
  "\u0420\u0430\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u044f": "#F97316",
  "\u041f\u0440\u043e\u0447\u0435\u0435": "#F59E0B",
}
const FLOW_NAME_MAP: Record<string, string> = {
  Work: "\u0420\u0430\u0431\u043e\u0442\u0430",
  Learning: "\u041e\u0431\u0443\u0447\u0435\u043d\u0438\u0435",
  Communication: "\u041e\u0431\u0449\u0435\u043d\u0438\u0435",
  Entertainment: "\u0420\u0430\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u044f",
  Routine: "\u041f\u0440\u043e\u0447\u0435\u0435",
}
const GENERIC_STREAM_NAMES = new Set([
  "\u0440\u0430\u0431\u043e\u0442\u0430",
  "\u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435",
  "\u043e\u0431\u0449\u0435\u043d\u0438\u0435",
  "\u0440\u0430\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u044f",
  "\u0440\u0443\u0442\u0438\u043d\u0430",
  "\u043f\u0440\u043e\u0447\u0435\u0435",
  "\u043a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f",
  "communication",
  "work",
  "learning",
  "routine",
  "other",
  "entertainment",
  "stream",
  "task",
])
const MAX_LLM_ITEMS = 72
const MIN_PROJECT_ITEM_MINUTES = 8
const MAX_PROJECTS_PER_BASE_CONTEXT = 3
const LLM_CHUNK_SIZE = 12
const LLM_REQUEST_TIMEOUT_MS = 240_000
const MAX_MERGE_CANDIDATES = 18
const OTHER_FLOW_NAME = "\u041f\u0440\u043e\u0447\u0435\u0435"
const COMMUNICATION_FLOW_NAME = "\u041e\u0431\u0449\u0435\u043d\u0438\u0435"

type LlmMergeCandidate = {
  stream_name: string
  flow_name: string
  total_minutes: number
  activities: number[]
  project_hint?: string | null
  project_key?: string | null
  examples: string[]
}

type PreclassifiedGroup = {
  flow_name: string
  stream_name: string
  activities: number[]
}

export function buildLlmSummaryPayload(
  logs: ActivityLogRecord[],
  idleLogs: IdleLogRecord[],
  date = new Date(),
): LlmSummaryPayload {
  const activeItems = collapseActivityLogsForLlm(
    logs
      .filter((log) => isSameDay(new Date(log.start_time), date))
      .map((log) => {
        const hints = buildContextHints(log.app_name, log.url, log.window_title)

        return {
          app: log.app_name,
          end_time: log.end_time,
          kind: "activity" as const,
          note: null,
          start_time: log.start_time,
          title: log.window_title,
          url: log.url,
          domain: hints.domain,
          project_hint: hints.projectHint,
          project_key: hints.projectKey,
          hint_flow: hints.hintFlow,
          duration_minutes: roundMinutes(durationMinutes(log)),
          examples: collectExamples(log.window_title, log.url),
        }
      }),
  )

  const idleItems = idleLogs
    .filter((log) => !log.ignored && isSameDay(new Date(log.start_time), date))
    .map((log) => ({
      app: "Idle",
      end_time: log.end_time,
      kind: "idle" as const,
      note: log.note,
      start_time: log.start_time,
      title: log.note || "\u041f\u0435\u0440\u0435\u0440\u044b\u0432",
      url: null,
      domain: null,
      project_hint: null,
      project_key: null,
      hint_flow: "Routine" as const,
      duration_minutes: roundMinutes(durationMinutes(log)),
      episodes: 1,
      examples: log.note ? [log.note] : [],
    }))

  const items = [...shrinkLlmItems(activeItems), ...idleItems]
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
    total_idle_minutes: roundMinutes(idleItems.reduce((sum, item) => sum + item.duration_minutes, 0)),
    items,
  }
}

function collapseActivityLogsForLlm(logs: DraftLlmActivity[]) {
  const grouped = new Map<string, DraftLlmActivity>()

  for (const item of logs) {
    const contextKey = buildCollapseKey(item)
    const existing = grouped.get(contextKey)

    if (existing) {
      existing.duration_minutes = roundMinutes(existing.duration_minutes + item.duration_minutes)
      existing.end_time = laterTime(existing.end_time, item.end_time)
      existing.start_time = earlierTime(existing.start_time, item.start_time)
      existing.episodes = (existing.episodes ?? 1) + 1
      existing.examples = mergeExamples(existing.examples, item.examples)
      existing.title = selectRepresentativeTitle(existing, item)
      if (!existing.project_hint && item.project_hint) {
        existing.project_hint = item.project_hint
      }
      if (!existing.project_key && item.project_key) {
        existing.project_key = item.project_key
      }
      if (!existing.hint_flow && item.hint_flow) {
        existing.hint_flow = item.hint_flow
      }
      continue
    }

    grouped.set(contextKey, {
      ...item,
      title: item.title || item.domain || item.app,
      url: item.domain ? `https://${item.domain}` : item.url,
      episodes: 1,
      examples: mergeExamples([], item.examples),
    })
  }

  return [...grouped.values()]
}

function shrinkLlmItems(items: DraftLlmActivity[]) {
  if (items.length <= MAX_LLM_ITEMS) {
    return items
  }

  const byBaseContext = new Map<string, DraftLlmActivity[]>()

  for (const item of items) {
    const baseKey = baseContextKey(item)
    const bucket = byBaseContext.get(baseKey) ?? []
    bucket.push(item)
    byBaseContext.set(baseKey, bucket)
  }

  const reduced: DraftLlmActivity[] = []

  for (const bucket of byBaseContext.values()) {
    const sorted = [...bucket].sort((left, right) => right.duration_minutes - left.duration_minutes)
    const keep: DraftLlmActivity[] = []
    const merge: DraftLlmActivity[] = []

    sorted.forEach((item, index) => {
      const shouldKeep =
        index < MAX_PROJECTS_PER_BASE_CONTEXT || item.duration_minutes >= MIN_PROJECT_ITEM_MINUTES

      if (shouldKeep) {
        keep.push(item)
      } else {
        merge.push(item)
      }
    })

    reduced.push(...keep)

    if (merge.length > 0) {
      reduced.push(mergeMinorContexts(merge))
    }
  }

  if (reduced.length <= MAX_LLM_ITEMS) {
    return reduced
  }

  const sorted = [...reduced].sort((left, right) => right.duration_minutes - left.duration_minutes)
  const kept = sorted.slice(0, MAX_LLM_ITEMS - 1)
  const tail = sorted.slice(MAX_LLM_ITEMS - 1)

  if (tail.length === 0) {
    return kept
  }

  return [...kept, mergeMinorContexts(tail, "\u041f\u0440\u043e\u0447\u0438\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u044b")]
}

function splitPayloadForHybridSummary(payload: LlmSummaryPayload) {
  const llmItems: LlmSummaryItem[] = []
  const directBuckets = new Map<string, PreclassifiedGroup>()

  for (const item of payload.items) {
    const directGroup = classifyDirectGroup(item)

    if (!directGroup) {
      llmItems.push(item)
      continue
    }

    const key = `${directGroup.flow_name}::${directGroup.stream_name}`
    const existing = directBuckets.get(key)

    if (existing) {
      existing.activities = [...new Set([...existing.activities, item.index])].sort((left, right) => left - right)
      continue
    }

    directBuckets.set(key, {
      ...directGroup,
      activities: [item.index],
    })
  }

  return {
    directGroups: [...directBuckets.values()],
    llmPayload: {
      ...payload,
      items: llmItems,
    },
  }
}

function classifyDirectGroup(item: LlmSummaryItem): Omit<PreclassifiedGroup, "activities"> | null {
  if (item.kind === "idle") {
    return {
      flow_name: OTHER_FLOW_NAME,
      stream_name: item.note?.trim() || "\u041f\u0435\u0440\u0435\u0440\u044b\u0432",
    }
  }

  if (item.hint_flow === "Communication") {
    return {
      flow_name: COMMUNICATION_FLOW_NAME,
      stream_name: deriveCommunicationStreamName([item]),
    }
  }

  const hints = buildContextHints(item.app, item.url, item.title)
  const projectBearing = Boolean(item.project_hint || hints.projectHint)
  const workCandidate =
    isWorkCandidateApp(hints.normalizedApp) ||
    isWorkCandidateDomain(hints.domain) ||
    (isBrowserApp(hints.normalizedApp) && Boolean(hints.domain))

  if (workCandidate || projectBearing) {
    return null
  }

  return {
    flow_name: OTHER_FLOW_NAME,
    stream_name: deriveOtherStreamName(item, hints.domain),
  }
}

function deriveOtherStreamName(item: LlmSummaryItem, domain: string | null) {
  if (domain) {
    return domain
  }

  const title = item.title?.trim()
  if (title && title.length >= 4 && !containsCjk(title)) {
    return title.slice(0, 80)
  }

  return item.app.replace(/\.exe$/i, "")
}

export function stringifyLlmPayload(payload: LlmSummaryPayload) {
  return JSON.stringify(payload, null, 2)
}

export function buildLlmCacheSignature(payload: LlmSummaryPayload, settings: LlmProviderSettings) {
  return JSON.stringify({
    version: 5,
    date: payload.date,
    provider: settings.provider,
    model: settings.model,
    items: payload.items.map((item) => ({
      index: item.index,
      kind: item.kind,
      app: item.app,
      title: item.title,
      url: item.url,
      domain: item.domain,
      note: item.note,
      hint_flow: item.hint_flow,
      project_hint: item.project_hint,
      project_key: item.project_key,
      start_time: item.start_time,
      end_time: item.end_time,
      duration_minutes: item.duration_minutes,
      examples: item.examples,
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

  const { directGroups, llmPayload } = splitPayloadForHybridSummary(payload)

  if (llmPayload.items.length === 0) {
    return directGroups
  }

  const chunks = splitPayloadIntoChunks(llmPayload, LLM_CHUNK_SIZE)
  const partialGroups: LlmSummaryGroup[] = []

  for (const chunk of chunks) {
    const groups = await requestSummaryPass(chunk, settings, buildChunkPrompt(chunk))
    partialGroups.push(...groups)
  }

  if (chunks.length === 1) {
    return [...directGroups, ...partialGroups]
  }

  try {
    const merged = await requestMergePass(llmPayload, partialGroups, settings)
    return [...directGroups, ...merged]
  } catch (error) {
    console.warn("LLM merge pass failed, using flattened chunk groups", error)
    return [...directGroups, ...flattenChunkGroups(llmPayload, partialGroups)]
  }
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
    const flowName = group.flow_name.trim() || OTHER_FLOW_NAME
    const streamName = group.stream_name.trim() || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"
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
      flows.get(OTHER_FLOW_NAME) ??
      new Map<string, { minutes: number; activities: number; details: FlowStreamActivity[] }>()
    const stream = flow.get("\u041d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d\u043e") ?? {
      minutes: 0,
      activities: 0,
      details: [],
    }

    for (const item of missedItems) {
      stream.minutes += item.duration_minutes
      stream.activities += 1
      stream.details.push(toFlowStreamActivity(item))
    }

    flow.set("\u041d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d\u043e", stream)
    flows.set(OTHER_FLOW_NAME, flow)
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

export function readLlmSettings(settings: { key: string; value: string }[]): LlmProviderSettings {
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

function buildLlmPrompt(payload: LlmSummaryPayload) {
  const compactItems = payload.items.map((item) => ({
    index: item.index,
    kind: item.kind,
    app: item.app,
    title: item.title,
    url: item.url,
    domain: item.domain,
    project_hint: item.project_hint ?? null,
    project_key: item.project_key ?? null,
    note: item.note,
    duration_minutes: item.duration_minutes,
    episodes: item.episodes ?? 1,
    hint_flow: item.hint_flow ?? null,
    examples: item.examples ?? [],
  }))

  return `You are a productivity analyst for a Russian-language time tracker.

Return only JSON that matches the provided schema. Do not use markdown. Do not explain anything.

Rules:
- Put groups into the "tasks" array.
- "activities" must contain only numeric indexes from the input.
- Do not leave a group with an empty "activities" array.
- Do not invent activity indexes.
- Use exactly one flow_name value: Work, Learning, Communication, Entertainment, Routine.
- stream_name must be a short human-readable Russian label.
- Never use Chinese, Japanese or Korean characters in stream_name.
- If hint_flow is Communication, treat that activity as communication unless the input clearly proves otherwise.
- If hint_flow is Work, treat that activity as work unless the input clearly proves otherwise.
- Telegram, Slack, Discord, WhatsApp, MAX and Yandex Messenger contexts belong to Communication, including their web versions.
- IDEs, design tools, project trackers, work calendars and video-call tools with hint_flow Work should stay inside Work and be grouped by project or workstream.
- If project_hint is present, prefer it as the strongest clue for the stream name unless the examples clearly prove a better Russian project label.
- If project_key is present, use it to keep the same project together across different apps and titles.
- Use the examples array to infer concrete projects from document titles, Figma files, tasks, repositories, specs and browser tab names.
- If the same project appears in several contexts, merge those activities into one stream.
- Idle items with a note are valid user activity. Idle items without a note belong to Routine.

Input:
${JSON.stringify(compactItems, null, 2)}`
}

function buildChunkPrompt(payload: LlmSummaryPayload) {
  return `${buildLlmPrompt(payload)}

This input is only one chunk of the same day. Be precise inside the chunk and preserve project distinctions when titles/examples point to different workstreams.`
}

function buildMergePrompt(payload: LlmSummaryPayload, candidates: LlmMergeCandidate[]) {
  return `You are merging chunk summaries for a Russian-language time tracker day.

Return only JSON that matches the provided schema. Do not use markdown. Do not explain anything.

Rules:
- Put groups into the "tasks" array.
- "activities" must contain only numeric indexes from the candidates input.
- Do not leave a group with an empty "activities" array.
- Do not invent activity indexes.
- Use exactly one flow_name value: Work, Learning, Communication, Entertainment, Routine.
- stream_name must be a short human-readable Russian label.
- Never use Chinese, Japanese or Korean characters in stream_name.
- Merge candidates that clearly belong to the same project or stream across chunks.
- Keep communication contexts inside Communication unless the input clearly proves otherwise.
- Keep candidates with clear Work evidence inside Work unless the input clearly proves otherwise.
- If several candidates share the same project_hint or clearly describe the same project, merge them into one stream.
- If several candidates share the same project_key, merge them into one stream.
- Prefer concrete project labels from examples over generic app names.

Day:
${JSON.stringify(
    {
      date: payload.date,
      total_active_minutes: payload.total_active_minutes,
      candidate_count: candidates.length,
    },
    null,
    2,
  )}

Candidates:
${JSON.stringify(candidates, null, 2)}`
}
function parseLlmGroups(rawResponse: string): LlmSummaryGroup[] {
  const jsonText = extractJson(rawResponse)
  const parsed = JSON.parse(jsonText) as unknown
  const groups = Array.isArray(parsed) ? parsed : pickGroupsArray(parsed)

  if (!groups) {
    throw new Error("LLM \u0432\u0435\u0440\u043d\u0443\u043b\u0430 \u043d\u0435 JSON-\u043c\u0430\u0441\u0441\u0438\u0432")
  }

  return groups
    .map((item) => normalizeGroup(item))
    .filter((item): item is LlmSummaryGroup => item !== null)
}

function postProcessLlmGroups(payload: LlmSummaryPayload, groups: LlmSummaryGroup[]) {
  return groups.map((group) => {
    const items = group.activities
      .map((index) => payload.items.find((item) => item.index === index) ?? null)
      .filter((item): item is LlmSummaryItem => item !== null)

    const forcedCommunication =
      items.length > 0 && items.every((item) => item.hint_flow === "Communication")

    const flow_name = forcedCommunication ? COMMUNICATION_FLOW_NAME : group.flow_name
    const stream_name = sanitizeStreamName(group.stream_name, flow_name, items)

    return {
      ...group,
      flow_name,
      stream_name,
    }
  })
}

function sanitizeStreamName(streamName: string, flowName: string, items: LlmSummaryItem[]) {
  if (flowName === "\u041e\u0431\u0449\u0435\u043d\u0438\u0435") {
    return deriveCommunicationStreamName(items)
  }

  const trimmed = streamName.trim()
  const looksBroken =
    !trimmed || containsCjk(trimmed) || GENERIC_STREAM_NAMES.has(trimmed.toLowerCase())

  if (!looksBroken) {
    return trimmed
  }

  const derived =
    deriveStreamNameFromItems(items) ||
    fallbackStreamNameByFlow(flowName)

  return derived
}

function deriveCommunicationStreamName(items: LlmSummaryItem[]) {
  const labels = [...new Set(items.map((item) => communicationSourceLabel(item)).filter(Boolean))]

  if (labels.length === 1) {
    return labels[0]!
  }

  return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 \u0447\u0430\u0442\u0430\u0445"
}

function communicationSourceLabel(item: LlmSummaryItem) {
  const app = normalizeAppName(item.app)
  const domain = item.domain ?? ""

  if (app === "telegram" || app === "telegramdesktop" || domain.includes("telegram") || domain === "t.me") {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 Telegram"
  }

  if (app === "slack" || domain.includes("slack.com")) {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 Slack"
  }

  if (app === "discord" || domain.includes("discord")) {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 Discord"
  }

  if (app === "whatsapp" || domain.includes("whatsapp")) {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 WhatsApp"
  }

  if (app === "max" || app === "maxmessenger" || domain.includes("max.ru")) {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 MAX"
  }

  if (app === "yandexmessenger" || app === "yamb" || domain.includes("messenger.yandex.ru")) {
    return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 \u042f\u043d\u0434\u0435\u043a\u0441 \u041c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440\u0435"
  }

  return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 \u0447\u0430\u0442\u0430\u0445"
}

function deriveStreamNameFromItems(items: LlmSummaryItem[]) {
  const candidates = new Map<string, number>()

  for (const item of items) {
    const values = [item.title, ...(item.examples ?? [])]

    for (const value of values) {
      const candidate = pickMeaningfulLabel(value)
      if (!candidate) {
        continue
      }

      candidates.set(candidate, (candidates.get(candidate) ?? 0) + item.duration_minutes)
    }
  }

  return [...candidates.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function pickMeaningfulLabel(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parts = value
    .split(/\s+[РІР‚вЂќРІР‚вЂњ|-]\s+|\s+\|\s+|\s+Р’В·\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const candidate = parts.sort((left, right) => right.length - left.length)[0] ?? value.trim()

  if (candidate.length < 4 || containsCjk(candidate)) {
    return null
  }

  return candidate.slice(0, 80)
}

function fallbackStreamNameByFlow(flowName: string) {
  switch (flowName) {
    case "\u0420\u0430\u0431\u043e\u0442\u0430":
      return "\u0420\u0430\u0431\u043e\u0447\u0438\u0439 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442"
    case "\u041e\u0431\u0443\u0447\u0435\u043d\u0438\u0435":
      return "\u0423\u0447\u0435\u0431\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442"
    case COMMUNICATION_FLOW_NAME:
      return "\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 \u0447\u0430\u0442\u0430\u0445"
    case "\u0420\u0430\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u044f":
      return "\u0420\u0430\u0437\u0432\u043b\u0435\u043a\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442"
    default:
      return "\u041f\u0440\u043e\u0447\u0435\u0435"
  }
}

function containsCjk(value: string) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(value)
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

  throw new Error("LLM \u0432\u0435\u0440\u043d\u0443\u043b\u0430 \u043d\u0435 JSON-\u043c\u0430\u0441\u0441\u0438\u0432")
}

function splitPayloadIntoChunks(payload: LlmSummaryPayload, chunkSize: number) {
  const chunks: LlmSummaryPayload[] = []

  for (let index = 0; index < payload.items.length; index += chunkSize) {
    chunks.push({
      ...payload,
      items: payload.items.slice(index, index + chunkSize),
    })
  }

  return chunks
}

async function requestSummaryPass(
  payload: LlmSummaryPayload,
  settings: LlmProviderSettings,
  prompt: string,
) {
  const data = await requestOllamaJson(settings, prompt)
  return postProcessLlmGroups(payload, parseLlmGroups(data.response ?? ""))
}

async function requestMergePass(
  payload: LlmSummaryPayload,
  chunkGroups: LlmSummaryGroup[],
  settings: LlmProviderSettings,
) {
  const candidates = buildMergeCandidates(payload, chunkGroups)
  const data = await requestOllamaJson(settings, buildMergePrompt(payload, candidates))
  const merged = postProcessLlmGroups(payload, parseLlmGroups(data.response ?? ""))

  return merged.length > 0 ? merged : flattenChunkGroups(payload, chunkGroups)
}

async function requestOllamaJson(settings: LlmProviderSettings, prompt: string) {
  let data: OllamaGenerateResponse

  if (isTauriRuntime()) {
    data = await withTimeout(
      requestOllamaGenerate({
        baseUrl: normalizeOllamaUrl(settings.ollamaUrl),
        model: settings.model,
        prompt,
        format: LLM_RESPONSE_SCHEMA,
      }),
      LLM_REQUEST_TIMEOUT_MS,
      "Ollama \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043e\u043b\u0433\u043e \u043d\u0435 \u043e\u0442\u0432\u0435\u0447\u0430\u0435\u0442",
    )
  } else {
    const response = await withTimeout(
      fetch(`${normalizeOllamaUrl(settings.ollamaUrl)}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model,
          prompt,
          stream: false,
          format: LLM_RESPONSE_SCHEMA,
          options: {
            temperature: 0,
          },
        }),
      }),
      LLM_REQUEST_TIMEOUT_MS,
      "Ollama \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043e\u043b\u0433\u043e \u043d\u0435 \u043e\u0442\u0432\u0435\u0447\u0430\u0435\u0442",
    )

    if (!response.ok) {
      const details = await response.text()
      throw new Error(details || `Ollama returned HTTP ${response.status}`)
    }

    data = (await response.json()) as OllamaGenerateResponse
  }

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

function buildMergeCandidates(payload: LlmSummaryPayload, groups: LlmSummaryGroup[]): LlmMergeCandidate[] {
  const itemsByIndex = new Map(payload.items.map((item) => [item.index, item]))

  const rawCandidates = groups.map((group) => {
    const items = group.activities
      .map((index) => itemsByIndex.get(index) ?? null)
      .filter((item): item is LlmSummaryItem => item !== null)

    return {
      stream_name: group.stream_name,
      flow_name: normalizeFlowNameForPrompt(group.flow_name),
      total_minutes: roundMinutes(items.reduce((sum, item) => sum + item.duration_minutes, 0)),
      activities: [...new Set(group.activities)].sort((left, right) => left - right),
      project_hint:
        items
          .map((item) => item.project_hint)
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => right.length - left.length)[0] ?? null,
      project_key:
        items
          .map((item) => item.project_key)
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => right.length - left.length)[0] ?? null,
      examples: mergeExamples(
        [],
        items.flatMap((item) => item.examples ?? [item.title ?? item.app]).filter(Boolean),
      ).slice(0, 3),
    }
  })

  return compactMergeCandidates(rawCandidates)
}

function compactMergeCandidates(candidates: LlmMergeCandidate[]) {
  const merged = new Map<string, LlmMergeCandidate>()

  for (const candidate of candidates) {
    const key = mergeCandidateKey(candidate)
    const existing = merged.get(key)

    if (existing) {
      existing.total_minutes = roundMinutes(existing.total_minutes + candidate.total_minutes)
      existing.activities = [...new Set([...existing.activities, ...candidate.activities])].sort(
        (left, right) => left - right,
      )
      existing.examples = mergeExamples(existing.examples, candidate.examples).slice(0, 3)
      if (!existing.project_hint && candidate.project_hint) {
        existing.project_hint = candidate.project_hint
      }
      if (!existing.project_key && candidate.project_key) {
        existing.project_key = candidate.project_key
      }
      continue
    }

    merged.set(key, {
      ...candidate,
      activities: [...candidate.activities].sort((left, right) => left - right),
      examples: [...candidate.examples].slice(0, 3),
    })
  }

  const compacted = [...merged.values()].sort((left, right) => right.total_minutes - left.total_minutes)

  if (compacted.length <= MAX_MERGE_CANDIDATES) {
    return compacted
  }

  const kept = compacted.slice(0, MAX_MERGE_CANDIDATES - 1)
  const tail = compacted.slice(MAX_MERGE_CANDIDATES - 1)

  return [
    ...kept,
    {
      stream_name: "\u041f\u0440\u043e\u0447\u0438\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0435 \u0440\u0430\u0431\u043e\u0447\u0438\u0435 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u044b",
      flow_name: "Work",
      total_minutes: roundMinutes(tail.reduce((sum, item) => sum + item.total_minutes, 0)),
      activities: [...new Set(tail.flatMap((item) => item.activities))].sort((left, right) => left - right),
      project_hint: null,
      project_key: null,
      examples: mergeExamples(
        [],
        tail.flatMap((item) => item.examples),
      ).slice(0, 3),
    },
  ]
}

function mergeCandidateKey(candidate: LlmMergeCandidate) {
  const flow = candidate.flow_name

  if (flow === "Communication") {
    return `${flow}::${candidate.stream_name.trim().toLowerCase()}`
  }

  if (candidate.project_key) {
    return `${flow}::project:${candidate.project_key}`
  }

  if (candidate.project_hint) {
    return `${flow}::project:${slugify(candidate.project_hint)}`
  }

  return `${flow}::${candidate.stream_name.trim().toLowerCase()}`
}

function flattenChunkGroups(payload: LlmSummaryPayload, groups: LlmSummaryGroup[]) {
  const merged = new Map<string, LlmSummaryGroup>()

  for (const group of groups) {
    const key = `${group.flow_name}::${group.stream_name}`
    const existing = merged.get(key)

    if (existing) {
      existing.activities = [...new Set([...existing.activities, ...group.activities])].sort(
        (left, right) => left - right,
      )
      continue
    }

    merged.set(key, {
      ...group,
      activities: [...new Set(group.activities)].sort((left, right) => left - right),
    })
  }

  return postProcessLlmGroups(payload, [...merged.values()])
}

function normalizeFlowNameForPrompt(flowName: string) {
  const entry = Object.entries(FLOW_NAME_MAP).find(([, localized]) => localized === flowName)
  return entry?.[0] ?? flowName
}
function normalizeOllamaUrl(value: string) {
  const trimmed = value.trim() || DEFAULT_LLM_SETTINGS.ollamaUrl
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withProtocol.replace(/\/+$/, "")
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)

    promise
      .then((result) => {
        window.clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

function settingValue(settings: { key: string; value: string }[], key: string, fallback: string) {
  return settings.find((setting) => setting.key === key)?.value.trim() || fallback
}

function formatMinutes(totalMinutes: number) {
  const rounded = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (hours === 0) {
    return `${minutes} \u043c\u0438\u043d`
  }

  if (minutes === 0) {
    return `${hours} \u0447`
  }

  return `${hours} \u0447 ${minutes} \u043c\u0438\u043d`
}

function parseDurationText(value: string) {
  const hoursMatch = value.match(/(\d+)\s*\u0447/u)
  const minutesMatch = value.match(/(\d+)\s*\u043c\u0438\u043d/u)
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

function formatClock(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function durationMinutes(log: TimeRangeRecord) {
  const start = timeValue(log.start_time)
  const end = timeValue(log.end_time)

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return (end - start) / 60_000
}

function buildCollapseKey(item: DraftLlmActivity) {
  const hints = buildContextHints(item.app, item.url, item.title)
  const base = hints.domain ? `site:${hints.domain}` : `app:${hints.normalizedApp}`

  if (item.hint_flow === "Communication") {
    return base
  }

  if (hints.projectKey) {
    return `${base}|project:${hints.projectKey}`
  }

  if (hints.projectHint) {
    return `${base}|project:${slugify(hints.projectHint)}`
  }

  return base
}

function baseContextKey(item: DraftLlmActivity) {
  return item.domain ? `site:${item.domain}` : `app:${normalizeAppName(item.app)}`
}

function mergeMinorContexts(items: DraftLlmActivity[], explicitTitle?: string): DraftLlmActivity {
  const sorted = [...items].sort((left, right) => timeValue(left.start_time) - timeValue(right.start_time))
  const first = sorted[0]!
  const examples = sorted.flatMap((item) => item.examples ?? [])
  const domain = first.domain

  return {
    ...first,
    title: explicitTitle ?? buildMergedTitle(first),
    url: domain ? `https://${domain}` : first.url,
    domain,
    duration_minutes: roundMinutes(
      sorted.reduce((sum, item) => sum + item.duration_minutes, 0),
    ),
    start_time: sorted[0]!.start_time,
    end_time: sorted[sorted.length - 1]!.end_time,
    episodes: sorted.reduce((sum, item) => sum + (item.episodes ?? 1), 0),
    examples: mergeExamples([], examples),
  }
}

function buildMergedTitle(item: DraftLlmActivity) {
  if (item.hint_flow === "Communication") {
    return `\u041a\u043e\u043c\u043c\u0443\u043d\u0438\u043a\u0430\u0446\u0438\u044f \u0432 ${item.app.replace(/\.exe$/i, "")}`
  }

  return item.domain
    ? `\u041f\u0440\u043e\u0447\u0438\u0435 \u043e\u043a\u043d\u0430 ${item.domain}`
    : `\u041f\u0440\u043e\u0447\u0438\u0435 \u043e\u043a\u043d\u0430 ${item.app.replace(/\.exe$/i, "")}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function collectExamples(title: string | null, url: string | null) {
  const examples = [title, url].filter(Boolean) as string[]
  return examples.slice(0, 5)
}

function mergeExamples(
  left: string[] | undefined,
  right: string[] | undefined,
) {
  return [...new Set([...(left ?? []), ...(right ?? [])])].slice(0, 5)
}

function selectRepresentativeTitle(existing: DraftLlmActivity, next: DraftLlmActivity) {
  const currentScore = titleScore(existing.title, existing.app)
  const nextScore = titleScore(next.title, next.app)
  return nextScore > currentScore ? next.title : existing.title
}

function titleScore(title: string | null, app: string) {
  if (!title) {
    return 0
  }

  const normalized = title.trim().toLowerCase()

  if (!normalized || normalized === app.trim().toLowerCase()) {
    return 1
  }

  if (containsCjk(normalized)) {
    return 2
  }

  return normalized.length
}

function earlierTime(left: string, right: string) {
  return timeValue(left) <= timeValue(right) ? left : right
}

function laterTime(left: string, right: string) {
  return timeValue(left) >= timeValue(right) ? left : right
}
