import { useEffect, useState } from "react"
import { Download, Globe, Shield, Sparkles, Trash2, Workflow } from "lucide-react"

import { StateCard } from "@/components/app/StateCard"
import { Button } from "@/components/ui/button"
import { settingsRows } from "@/data/mock"
import {
  addStoplistItem,
  exportFocusFlowData,
  getBrowserBridgeStatus,
  getSettings,
  getStoplist,
  removeStoplistItem,
  setSetting,
  type BrowserBridgeStatusRecord,
  type SettingEntryRecord,
  type StoplistItemRecord,
} from "@/lib/focusflow-api"
import {
  DEFAULT_LLM_SETTINGS,
  readLlmSettings,
  type LlmProviderSettings,
} from "@/lib/llm-summary"
import type { SettingRow } from "@/types"

const settingLabels: Record<string, string> = {
  language: "Язык",
  theme: "Тема",
  autostart: "Автозапуск",
  llm_provider: "LLM-провайдер",
  ollama_url: "Ollama",
  llm_model: "LLM-модель",
  export_format: "Экспорт",
}

const llmSettingLabels = new Set(["LLM-провайдер", "Ollama", "LLM-модель"])

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>(settingsRows)
  const [stoplist, setStoplist] = useState<StoplistItemRecord[]>([])
  const [llmSettings, setLlmSettings] = useState<LlmProviderSettings>(DEFAULT_LLM_SETTINGS)
  const [newAppName, setNewAppName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [savingLlm, setSavingLlm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [browserBridgeStatus, setBrowserBridgeStatus] = useState<BrowserBridgeStatusRecord | null>(null)
  const visibleRows = rows.filter((row) => !llmSettingLabels.has(row.label))

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      try {
        const [settings, stoplistItems, bridgeStatus] = await Promise.all([
          getSettings(),
          getStoplist(),
          getBrowserBridgeStatus(),
        ])

        if (!isMounted) {
          return
        }

        if (settings.length > 0) {
          setRows(settings.map(mapSetting))
          setLlmSettings(readLlmSettings(settings))
        }
        setStoplist(stoplistItems)
        setBrowserBridgeStatus(bridgeStatus)
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

  useEffect(() => {
    let isMounted = true
    const intervalId = window.setInterval(() => {
      void getBrowserBridgeStatus()
        .then((bridgeStatus) => {
          if (isMounted) {
            setBrowserBridgeStatus(bridgeStatus)
          }
        })
        .catch(() => undefined)
    }, 3000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  async function addAppToStoplist() {
    const value = newAppName.trim()

    if (!value) {
      return
    }

    if (
      stoplist.some(
        (item) => item.item_type === "app" && item.value.toLowerCase() === value.toLowerCase(),
      )
    ) {
      setNewAppName("")
      return
    }

    try {
      const nextItem = await addStoplistItem({ item_type: "app", value })
      setStoplist((current) =>
        [...current, nextItem].sort((left, right) => left.value.localeCompare(right.value)),
      )
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

  async function saveLlmSettings() {
    setSavingLlm(true)

    try {
      await Promise.all([
        setSetting("llm_provider", llmSettings.provider),
        setSetting("ollama_url", llmSettings.ollamaUrl.trim() || DEFAULT_LLM_SETTINGS.ollamaUrl),
        setSetting("llm_model", llmSettings.model.trim() || DEFAULT_LLM_SETTINGS.model),
      ])
      const settings = await getSettings()
      setRows(settings.map(mapSetting))
      setLlmSettings(readLlmSettings(settings))
      setError(null)
    } catch {
      setError("Не удалось сохранить настройки LLM")
    } finally {
      setSavingLlm(false)
    }
  }

  function updateLlmSettings(input: Partial<LlmProviderSettings>) {
    setLlmSettings((current) => ({ ...current, ...input }))
  }

  async function exportData() {
    setExporting(true)

    try {
      const payload = await exportFocusFlowData()
      downloadJsonFile(payload, `focusflow-export-${new Date().toISOString().slice(0, 10)}.json`)
      setError(null)
    } catch {
      setError("Не удалось подготовить экспорт данных")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <StateCard
          description="Служебный слой FocusFlow не смог сохранить или прочитать часть локальных настроек. Обычно помогает повторить действие."
          title={error}
          variant="error"
        />
      )}

      <section className="rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_left_bottom,rgba(175,220,188,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,252,247,0.9)_100%)] px-6 py-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
        <p className="font-['Georgia'] text-[2rem] leading-none text-[#24382F]">Настройки</p>
        <p className="mt-3 max-w-[720px] text-sm leading-6 text-[#6C7E74]">
          Здесь живет служебный слой FocusFlow: локальная модель, экспорт, browser bridge и
          стоп-лист. Он должен быть аккуратным и спокойным, но без лишней декоративности.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <SettingsCard
            description="Базовые параметры локального режима."
            icon={Shield}
            title="Параметры приложения"
          >
            <div className="grid gap-3">
              {visibleRows.map((row) => (
                <SettingMetric key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </SettingsCard>

          <SettingsCard
            description="Логи, простои, настройки, стоп-лист и сохраненные LLM-сводки в одном JSON."
            icon={Download}
            title="Экспорт"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#71837A]">
                Удобно для бэкапа, переноса данных и ручной проверки содержимого локальной базы.
              </p>
              <Button
                className="rounded-full px-4"
                disabled={exporting}
                onClick={() => void exportData()}
                type="button"
                variant="outline"
              >
                <Download className="size-4" data-icon="inline-start" />
                {exporting ? "Готовлю" : "Скачать JSON"}
              </Button>
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-5">
          <SettingsCard
            description="Локальный мост для получения URL активной вкладки."
            icon={Globe}
            title="Browser bridge"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingMetric
                label="Статус"
                value={browserBridgeStatus?.running ? "Работает" : "Не запущен"}
              />
              <SettingMetric label="Порт" value={String(browserBridgeStatus?.port ?? 17653)} />
            </div>
            <div className="mt-3 rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
              <p className="text-sm text-[#73867A]">Последняя вкладка</p>
              <p className="mt-2 truncate text-sm font-medium text-[#2B4236]">
                {browserBridgeStatus?.last_activity?.url ?? "Нет данных от расширения"}
              </p>
            </div>
          </SettingsCard>

          <SettingsCard
            description="Локальная группировка активностей через Ollama."
            icon={Sparkles}
            title="LLM"
          >
            <div className="grid gap-4">
              <Field label="Провайдер">
                <select
                  className="h-11 rounded-[16px] border border-[#DCE7DE] bg-white px-4 text-sm outline-none transition focus:border-[#9DC3AC] focus:ring-4 focus:ring-[#DDEDE2]"
                  onChange={() => updateLlmSettings({ provider: "ollama" })}
                  value={llmSettings.provider}
                >
                  <option value="ollama">Ollama</option>
                </select>
              </Field>

              <Field label="Адрес Ollama">
                <input
                  className="h-11 rounded-[16px] border border-[#DCE7DE] bg-white px-4 text-sm outline-none transition focus:border-[#9DC3AC] focus:ring-4 focus:ring-[#DDEDE2]"
                  onChange={(event) => updateLlmSettings({ ollamaUrl: event.target.value })}
                  placeholder="http://localhost:11434"
                  value={llmSettings.ollamaUrl}
                />
              </Field>

              <Field label="Модель">
                <input
                  className="h-11 rounded-[16px] border border-[#DCE7DE] bg-white px-4 text-sm outline-none transition focus:border-[#9DC3AC] focus:ring-4 focus:ring-[#DDEDE2]"
                  onChange={(event) => updateLlmSettings({ model: event.target.value })}
                  placeholder="qwen2.5:7b-instruct"
                  value={llmSettings.model}
                />
              </Field>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                className="rounded-full px-4"
                disabled={savingLlm}
                onClick={() => void saveLlmSettings()}
                type="button"
              >
                {savingLlm ? "Сохраняю" : "Сохранить LLM"}
              </Button>
            </div>
          </SettingsCard>

          <SettingsCard
            description="Эти процессы не попадают в лог активности."
            icon={Workflow}
            title="Стоп-лист приложений"
          >
            <div className="flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-[16px] border border-[#DCE7DE] bg-white px-4 text-sm outline-none transition focus:border-[#9DC3AC] focus:ring-4 focus:ring-[#DDEDE2]"
                onChange={(event) => setNewAppName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void addAppToStoplist()
                  }
                }}
                placeholder="process.exe"
                value={newAppName}
              />
              <Button className="rounded-full px-4" onClick={() => void addAppToStoplist()} type="button">
                Добавить
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {stoplist.length === 0 && (
                <StateCard
                  description="Добавь сюда процессы, которые не должны попадать в лог активности."
                  title="Стоп-лист пока пуст"
                  variant="empty"
                />
              )}

              {stoplist.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#263C31]">{item.value}</p>
                    <p className="mt-1 text-xs text-[#7A8C83]">
                      {item.item_type === "app" ? "Приложение" : "Сайт"}
                    </p>
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
          </SettingsCard>
        </div>
      </div>
    </div>
  )
}

function SettingsCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: React.ReactNode
  description: string
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-[#F1F7F2] text-[#5A9A73]">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-['Georgia'] text-[1.55rem] leading-none text-[#24382F]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[#71837A]">{description}</p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  )
}

function SettingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <p className="text-sm text-[#73867A]">{label}</p>
      <p className="mt-2 text-[1.02rem] font-medium text-[#2B4236]">{value}</p>
    </div>
  )
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-[#73867A]">{label}</span>
      {children}
    </label>
  )
}

function mapSetting(setting: SettingEntryRecord): SettingRow {
  return {
    label: settingLabels[setting.key] ?? setting.key,
    value: setting.value,
  }
}

function downloadJsonFile(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
