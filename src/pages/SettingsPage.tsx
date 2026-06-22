import { useEffect, useState } from "react"

import { settingsRows } from "@/data/mock"
import { getSettings, type SettingEntryRecord } from "@/lib/focusflow-api"
import type { SettingRow } from "@/types"

const settingLabels: Record<string, string> = {
  language: "Язык",
  theme: "Тема",
  autostart: "Автозапуск",
  llm_provider: "LLM-провайдер",
  ollama_url: "Ollama",
  export_format: "Экспорт",
}

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>(settingsRows)

  useEffect(() => {
    let isMounted = true

    getSettings()
      .then((settings) => {
        if (!isMounted || settings.length === 0) {
          return
        }

        setRows(settings.map(mapSetting))
      })
      .catch(() => {
        if (isMounted) {
          setRows(settingsRows)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Параметры приложения</h2>
        <p className="text-xs text-zinc-500">Сейчас это интерфейсный прототип настроек</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={row.label}>
            <span className="text-sm text-zinc-600">{row.label}</span>
            <span className="text-sm font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function mapSetting(setting: SettingEntryRecord): SettingRow {
  return {
    label: settingLabels[setting.key] ?? setting.key,
    value: setting.value,
  }
}
