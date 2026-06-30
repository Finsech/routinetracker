import type { FlowId, SettingKey, View } from "@/types"

export const NAV_LABELS: Record<View, string> = {
  today: "Сегодня",
  analytics: "Анализ дня",
  week: "Неделя",
  settings: "Настройки",
}

export const SETTING_LABELS: Record<SettingKey, string> = {
  language: "Язык",
  theme: "Тема",
  autostart: "Автозапуск",
  llm_provider: "LLM-провайдер",
  ollama_url: "Ollama",
  llm_model: "LLM-модель",
  export_format: "Экспорт",
}

export const FLOW_LABELS: Record<FlowId, string> = {
  raw: "Сырые активности",
  idle: "Простой",
  work: "Работа",
  learning: "Обучение",
  communication: "Общение",
  entertainment: "Развлечения",
  misc: "Прочее",
}

export const SETTINGS_NOTES: Partial<Record<SettingKey, string>> = {
  language: "Перевод в работе",
  theme: "В работе",
}

export function getFlowLabel(flowId: FlowId) {
  return FLOW_LABELS[flowId]
}

export function getSettingLabel(key: SettingKey) {
  return SETTING_LABELS[key]
}

export function resolveFlowIdFromLabel(value: string): FlowId {
  const normalized = value.trim().toLowerCase()

  switch (normalized) {
    case "сырые активности":
      return "raw"
    case "простой":
      return "idle"
    case "работа":
      return "work"
    case "обучение":
      return "learning"
    case "общение":
      return "communication"
    case "развлечения":
      return "entertainment"
    case "прочее":
    case "рутина":
      return "misc"
    default:
      return "misc"
  }
}
