import { useEffect, useState } from "react"
import { Download, Globe, Shield, Sparkles, Trash2, Workflow } from "lucide-react"

import { StateCard } from "@/components/app/StateCard"
import { Button } from "@/components/ui/button"
import { settingsRows } from "@/data/mock"
import {
  addStoplistItem,
  saveFocusFlowExport,
  type ExportFormat,
  getAutostartStatus,
  getBrowserBridgeStatus,
  getSettings,
  getStoplist,
  removeStoplistItem,
  setAutostartStatus,
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
import { UI_ERROR_COPY } from "@/lib/copy/errors"
import { SETTING_LABELS, SETTINGS_NOTES } from "@/lib/copy/ru"
import {
  AUTOSTART_SETTING_VALUE,
  getSettingDisplayValue,
} from "@/lib/settings-contract"
import type { SettingKey, SettingRow } from "@/types"

const hiddenSettingKeys = new Set<SettingKey>(["llm_provider", "ollama_url", "llm_model", "export_format"])

export function SettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>(settingsRows)
  const [stoplist, setStoplist] = useState<StoplistItemRecord[]>([])
  const [llmSettings, setLlmSettings] = useState<LlmProviderSettings>(DEFAULT_LLM_SETTINGS)
  const [stoplistType, setStoplistType] = useState<"app" | "site">("app")
  const [newStoplistValue, setNewStoplistValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [savingLlm, setSavingLlm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [browserBridgeStatus, setBrowserBridgeStatus] = useState<BrowserBridgeStatusRecord | null>(
    null,
  )
  const [autostartEnabled, setAutostartEnabled] = useState(false)
  const [autostartSaving, setAutostartSaving] = useState(false)
  const visibleRows = rows.filter((row) => !hiddenSettingKeys.has(row.key))

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
        void getAutostartStatus().then((value) => {
          if (isMounted) {
            setAutostartEnabled(value)
          }
        })
        setStoplist(stoplistItems)
        setBrowserBridgeStatus(bridgeStatus)
        setError(null)
      } catch {
        if (isMounted) {
          setRows(settingsRows)
          setError(UI_ERROR_COPY.settings.loadSettings)
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

  async function addStoplistValue() {
    const value = newStoplistValue.trim()

    if (!value) {
      return
    }

    if (
      stoplist.some(
        (item) =>
          item.item_type === stoplistType && item.value.toLowerCase() === value.toLowerCase(),
      )
    ) {
      setNewStoplistValue("")
      return
    }

    try {
      const nextItem = await addStoplistItem({ item_type: stoplistType, value })
      setStoplist((current) =>
        [...current, nextItem].sort((left, right) => left.value.localeCompare(right.value)),
      )
      setNewStoplistValue("")
      setError(null)
    } catch {
      setError(
        stoplistType === "app"
          ? UI_ERROR_COPY.settings.addStoplistApp
          : UI_ERROR_COPY.settings.addStoplistSite,
      )
    }
  }

  async function removeFromStoplist(id: number) {
    try {
      await removeStoplistItem(id)
      setStoplist((current) => current.filter((item) => item.id !== id))
      setError(null)
    } catch {
      setError(UI_ERROR_COPY.settings.removeStoplistItem)
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
      setExportMessage(null)
    } catch {
      setError(UI_ERROR_COPY.settings.saveLlmSettings)
    } finally {
      setSavingLlm(false)
    }
  }

  function updateLlmSettings(input: Partial<LlmProviderSettings>) {
    setLlmSettings((current) => ({ ...current, ...input }))
  }

  async function exportData(format: ExportFormat) {
    setExporting(true)

    try {
      const savedPath = await saveFocusFlowExport(format)
      setExportMessage(`Сохранено: ${savedPath}`)
      setError(null)
    } catch {
      setError(UI_ERROR_COPY.settings.exportData)
      setExportMessage(null)
    } finally {
      setExporting(false)
    }
  }

  async function toggleAutostart() {
    const nextValue = !autostartEnabled
    setAutostartSaving(true)

    try {
      const actualValue = await setAutostartStatus(nextValue)
      setAutostartEnabled(actualValue)
      await setSetting(
        "autostart",
        actualValue ? AUTOSTART_SETTING_VALUE.enabled : AUTOSTART_SETTING_VALUE.disabled,
      )
      setRows((current) =>
        current.map((row) =>
          row.key === "autostart"
            ? {
                ...row,
                value:
                  actualValue ? AUTOSTART_SETTING_VALUE.enabled : AUTOSTART_SETTING_VALUE.disabled,
              }
            : row,
        ),
      )
      setError(null)
      setExportMessage(null)
    } catch {
      setError(UI_ERROR_COPY.settings.changeAutostart)
    } finally {
      setAutostartSaving(false)
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
                row.key === "autostart" ? (
                  <AutostartMetric
                    enabled={autostartEnabled}
                    key={row.key}
                    onToggle={() => void toggleAutostart()}
                    saving={autostartSaving}
                  />
                ) : (
                  <SettingMetric
                    key={row.key}
                    label={row.label}
                    note={SETTINGS_NOTES[row.key]}
                    value={row.value}
                  />
                )
              ))}
            </div>
          </SettingsCard>

          <SettingsCard
            description="Для бэкапа и ручной аналитики: полный JSON-слепок или плоский CSV по активностям и простоям."
            icon={Download}
            title="Экспорт"
          >
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-6 text-[#71837A]">
                JSON полезен как полный локальный бэкап. CSV удобнее для Excel, таблиц и быстрой ручной проверки трека.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full px-4"
                  disabled={exporting}
                  onClick={() => void exportData("json")}
                  type="button"
                  variant="outline"
                >
                  <Download className="size-4" data-icon="inline-start" />
                  {exporting ? "Готовлю" : "Сохранить JSON"}
                </Button>
                <Button
                  className="rounded-full px-4"
                  disabled={exporting}
                  onClick={() => void exportData("csv")}
                  type="button"
                  variant="outline"
                >
                  <Download className="size-4" data-icon="inline-start" />
                  {exporting ? "Готовлю" : "Сохранить CSV"}
                </Button>
              </div>
              {exportMessage && <p className="text-sm text-[#5D7868]">{exportMessage}</p>}
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
                {browserBridgeStatus?.last_activity?.url ?? "Нет данных о вкладке"}
              </p>
            </div>
          </SettingsCard>

          <SettingsCard
            description="Локальная группировка активностей через Ollama."
            icon={Sparkles}
            title="LLM"
          >
            <div className="mb-4 rounded-[18px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3 text-sm text-[#73867A]">
              Сейчас поддерживается только локальная Ollama. Внешние провайдеры по токену — в работе.
            </div>
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
            description="Здесь можно исключать как процессы, так и сайты, которые не должны попадать в трекинг и локальный URL-мост."
            icon={Workflow}
            title="Стоп-лист"
          >
            <div className="flex flex-wrap gap-2">
              {[
                { id: "app", label: "Приложение" },
                { id: "site", label: "Сайт" },
              ].map((option) => {
                const active = stoplistType === option.id

                return (
                  <button
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-[#9DC3AC] bg-[#EEF7F0] text-[#264034] shadow-[0_6px_18px_rgba(123,166,139,0.18)]"
                        : "border-[#DCE7DE] bg-white text-[#73867A] hover:border-[#C4D8C8] hover:text-[#355344]"
                    }`}
                    key={option.id}
                    onClick={() => setStoplistType(option.id as "app" | "site")}
                    type="button"
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-[16px] border border-[#DCE7DE] bg-white px-4 text-sm outline-none transition focus:border-[#9DC3AC] focus:ring-4 focus:ring-[#DDEDE2]"
                onChange={(event) => setNewStoplistValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void addStoplistValue()
                  }
                }}
                placeholder={stoplistType === "app" ? "process.exe" : "youtube.com"}
                value={newStoplistValue}
              />
              <Button className="rounded-full px-4" onClick={() => void addStoplistValue()} type="button">
                Добавить
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#71837A]">
              {stoplistType === "app"
                ? "Для приложений используй имя процесса, например telegram.exe или discord.exe."
                : "Для сайтов достаточно части домена, например youtube.com, vk.com или reddit.com."}
            </p>

            <div className="mt-4 space-y-3">
              {stoplist.length === 0 && (
                <StateCard
                  description="Добавь сюда процессы или домены, которые не должны попадать в локальный лог активности."
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

function SettingMetric({
  label,
  note,
  value,
}: {
  label: string
  note?: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[#73867A]">{label}</p>
        {note && <span className="text-xs text-[#94A69B]">{note}</span>}
      </div>
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

function AutostartMetric({
  enabled,
  onToggle,
  saving,
}: {
  enabled: boolean
  onToggle: () => void
  saving: boolean
}) {
  return (
    <div className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#73867A]">Автозапуск</p>
          <p className="mt-2 text-[1.02rem] font-medium text-[#2B4236]">
            {enabled ? AUTOSTART_SETTING_VALUE.enabled : AUTOSTART_SETTING_VALUE.disabled}
          </p>
        </div>

        <button
          aria-label="Переключить автозапуск"
          className={`relative inline-flex h-8 w-14 items-center rounded-full border transition ${
            enabled
              ? "border-[#8EB89B] bg-[#DFF1E4]"
              : "border-[#D6E3D9] bg-white hover:border-[#BFD2C3]"
          } ${saving ? "cursor-wait opacity-70" : ""}`}
          disabled={saving}
          onClick={onToggle}
          type="button"
        >
          <span
            className={`inline-block size-6 rounded-full bg-white shadow-[0_6px_14px_rgba(68,94,79,0.18)] transition ${
              enabled ? "translate-x-[26px]" : "translate-x-[3px]"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function mapSetting(setting: SettingEntryRecord): SettingRow {
  const key = setting.key as SettingKey

  return {
    key,
    label: SETTING_LABELS[key] ?? setting.key,
    value: getSettingDisplayValue(key, setting.value),
  }
}
