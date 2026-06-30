const LLM_FLOW_ENUM = ["Work", "Learning", "Communication", "Entertainment", "Routine"] as const

export const LLM_RESPONSE_SCHEMA = {
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
            enum: LLM_FLOW_ENUM,
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

export const LLM_TIMEOUT_ERROR = "Ollama слишком долго не отвечает"
export const LLM_INVALID_JSON_ERROR = "LLM вернула не JSON-массив"

type SummaryPromptItem = {
  index: number
  kind: "activity" | "idle"
  app: string
  title: string | null
  url: string | null
  domain: string | null
  project_hint?: string | null
  project_key?: string | null
  note: string | null
  duration_minutes: number
  episodes: number
  hint_flow?: string | null
  examples: string[]
}

type MergePromptCandidate = {
  stream_name: string
  flow_name: string
  total_minutes: number
  activities: number[]
  project_hint?: string | null
  project_key?: string | null
  examples: string[]
}

type MergePromptMeta = {
  date: string
  total_active_minutes: number
}

const SUMMARY_PROMPT_HEADER = `You are a productivity analyst for a Russian-language time tracker.

Return only JSON that matches the provided schema. Do not use markdown. Do not explain anything.`

const SUMMARY_PROMPT_RULES = [
  'Put groups into the "tasks" array.',
  '"activities" must contain only numeric indexes from the input.',
  'Do not leave a group with an empty "activities" array.',
  "Do not invent activity indexes.",
  "Use exactly one flow_name value: Work, Learning, Communication, Entertainment, Routine.",
  "stream_name must be a short human-readable Russian label.",
  "Never use Chinese, Japanese or Korean characters in stream_name.",
  "If hint_flow is Communication, treat that activity as communication unless the input clearly proves otherwise.",
  "If hint_flow is Work, treat that activity as work unless the input clearly proves otherwise.",
  "Telegram, Slack, Discord, WhatsApp, MAX and Yandex Messenger contexts belong to Communication, including their web versions.",
  "IDEs, design tools, project trackers, work calendars and video-call tools with hint_flow Work should stay inside Work and be grouped by project or workstream.",
  "If project_hint is present, prefer it as the strongest clue for the stream name unless the examples clearly prove a better Russian project label.",
  "If project_key is present, use it to keep the same project together across different apps and titles.",
  "Use the examples array to infer concrete projects from document titles, Figma files, tasks, repositories, specs and browser tab names.",
  "If the same project appears in several contexts, merge those activities into one stream.",
  "Idle items with a note are valid user activity. Idle items without a note belong to Routine.",
] as const

const CHUNK_PROMPT_SUFFIX =
  "This input is only one chunk of the same day. Be precise inside the chunk and preserve project distinctions when titles/examples point to different workstreams."

const MERGE_PROMPT_HEADER = `You are merging chunk summaries for a Russian-language time tracker day.

Return only JSON that matches the provided schema. Do not use markdown. Do not explain anything.`

const MERGE_PROMPT_RULES = [
  'Put groups into the "tasks" array.',
  '"activities" must contain only numeric indexes from the candidates input.',
  'Do not leave a group with an empty "activities" array.',
  "Do not invent activity indexes.",
  "Use exactly one flow_name value: Work, Learning, Communication, Entertainment, Routine.",
  "stream_name must be a short human-readable Russian label.",
  "Never use Chinese, Japanese or Korean characters in stream_name.",
  "Merge candidates that clearly belong to the same project or stream across chunks.",
  "Keep communication contexts inside Communication unless the input clearly proves otherwise.",
  "Keep candidates with clear Work evidence inside Work unless the input clearly proves otherwise.",
  "If several candidates share the same project_hint or clearly describe the same project, merge them into one stream.",
  "If several candidates share the same project_key, merge them into one stream.",
  "Prefer concrete project labels from examples over generic app names.",
] as const

export function buildSummaryPrompt(items: SummaryPromptItem[]) {
  return `${SUMMARY_PROMPT_HEADER}

Rules:
${SUMMARY_PROMPT_RULES.map((rule) => `- ${rule}`).join("\n")}

Input:
${JSON.stringify(items, null, 2)}`
}

export function buildChunkPrompt(items: SummaryPromptItem[]) {
  return `${buildSummaryPrompt(items)}

${CHUNK_PROMPT_SUFFIX}`
}

export function buildMergePrompt(meta: MergePromptMeta, candidates: MergePromptCandidate[]) {
  return `${MERGE_PROMPT_HEADER}

Rules:
${MERGE_PROMPT_RULES.map((rule) => `- ${rule}`).join("\n")}

Day:
${JSON.stringify(
    {
      date: meta.date,
      total_active_minutes: meta.total_active_minutes,
      candidate_count: candidates.length,
    },
    null,
    2,
  )}

Candidates:
${JSON.stringify(candidates, null, 2)}`
}
