import type { SettingKey, SettingRow } from "@/types"
import { SETTING_LABELS } from "@/lib/copy/ru"

export const AUTOSTART_SETTING_VALUE = {
  enabled: "Включен",
  disabled: "Выключен",
} as const

export const EXPORT_FORMAT_DISPLAY_VALUE = "JSON / CSV"

export const DEFAULT_SETTING_VALUES: Record<SettingKey, string> = {
  language: "Русский",
  theme: "Системная",
  autostart: AUTOSTART_SETTING_VALUE.disabled,
  llm_provider: "ollama",
  ollama_url: "http://localhost:11434",
  llm_model: "qwen2.5:7b-instruct",
  export_format: "JSON",
}

const SETTING_KEYS: SettingKey[] = [
  "language",
  "theme",
  "autostart",
  "llm_provider",
  "ollama_url",
  "llm_model",
  "export_format",
]

export function buildDefaultSettingEntries() {
  return SETTING_KEYS.map((key) => ({
    key,
    value: DEFAULT_SETTING_VALUES[key],
  }))
}

export function buildDefaultSettingRows(): SettingRow[] {
  return buildDefaultSettingEntries().map(({ key, value }) => ({
    key,
    label: SETTING_LABELS[key],
    value: getSettingDisplayValue(key, value),
  }))
}

export function getSettingDisplayValue(key: SettingKey, value: string) {
  if (key === "export_format") {
    return EXPORT_FORMAT_DISPLAY_VALUE
  }

  return value
}
