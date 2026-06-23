import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { settingsRows } from "@/data/mock"
import {
  addStoplistItem,
  getSettings,
  getStoplist,
  removeStoplistItem,
  type SettingEntryRecord,
  type StoplistItemRecord,
} from "@/lib/focusflow-api"
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
  const [stoplist, setStoplist] = useState<StoplistItemRecord[]>([])
  const [newAppName, setNewAppName] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      try {
        const [settings, stoplistItems] = await Promise.all([getSettings(), getStoplist()])

        if (!isMounted) {
          return
        }

        if (settings.length > 0) {
          setRows(settings.map(mapSetting))
        }
        setStoplist(stoplistItems)
        setError(null)
      } catch {
        if (isMounted) {
          setRows(settingsRows)
          setError("Не удалось загрузить настройки")
        }
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  async function addAppToStoplist() {
    const value = newAppName.trim()

    if (!value) {
      return
    }

    if (stoplist.some((item) => item.item_type === "app" && item.value.toLowerCase() === value.toLowerCase())) {
      setNewAppName("")
      return
    }

    try {
      const nextItem = await addStoplistItem({ item_type: "app", value })
      setStoplist((current) => [...current, nextItem].sort((left, right) => left.value.localeCompare(right.value)))
      setNewAppName("")
      setError(null)
    } catch {
      setError("Не удалось добавить приложение в стоп-лист")
    }
  }

  async function removeFromStoplist(id: number) {
    try {
      await removeStoplistItem(id)
      setStoplist((current) => current.filter((item) => item.id !== id))
      setError(null)
    } catch {
      setError("Не удалось удалить приложение из стоп-листа")
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-md border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Параметры приложения</h2>
          <p className="text-xs text-zinc-500">Базовые параметры локального режима</p>
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

      <section className="rounded-md border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Стоп-лист приложений</h2>
          <p className="text-xs text-zinc-500">Эти процессы не попадают в логи активности</p>
        </div>

        <div className="flex gap-2 border-b border-zinc-100 px-4 py-3">
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
            onChange={(event) => setNewAppName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void addAppToStoplist()
              }
            }}
            placeholder="process.exe"
            value={newAppName}
          />
          <Button onClick={() => void addAppToStoplist()} type="button">
            Добавить
          </Button>
        </div>

        <div className="divide-y divide-zinc-100">
          {stoplist.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">Стоп-лист пуст</div>
          )}

          {stoplist.map((item) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.value}</p>
                <p className="text-xs text-zinc-500">{item.item_type === "app" ? "Приложение" : "Сайт"}</p>
              </div>
              <Button
                aria-label={`Удалить ${item.value}`}
                onClick={() => void removeFromStoplist(item.id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function mapSetting(setting: SettingEntryRecord): SettingRow {
  return {
    label: settingLabels[setting.key] ?? setting.key,
    value: setting.value,
  }
}
