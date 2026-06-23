import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { DayTimeline } from "@/components/dashboard/DayTimeline"
import { FlowCard } from "@/components/dashboard/FlowCard"
import { LlmPrepCard } from "@/components/dashboard/LlmPrepCard"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Button } from "@/components/ui/button"
import { buildTodaySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  getLlmSummary,
  getSettings,
  saveLlmSummary,
  updateIdleLog,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"
import {
  DEFAULT_LLM_SETTINGS,
  buildLlmCacheSignature,
  buildFlowsFromLlmGroups,
  buildLlmSummaryPayload,
  parseStoredLlmGroups,
  readLlmSettings,
  requestOllamaSummary,
  serializeLlmGroups,
  type LlmProviderSettings,
} from "@/lib/llm-summary"
import type { FlowStream, FlowSummary } from "@/types"

type SelectedStream = {
  flow: FlowSummary
  stream: FlowStream
}

export function TodayPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [idleNote, setIdleNote] = useState("")
  const [postponedIdleIds, setPostponedIdleIds] = useState<number[]>([])
  const [llmSettings, setLlmSettings] = useState<LlmProviderSettings>(DEFAULT_LLM_SETTINGS)
  const [llmFlows, setLlmFlows] = useState<FlowSummary[] | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmCachedAt, setLlmCachedAt] = useState<string | null>(null)
  const [selectedStream, setSelectedStream] = useState<SelectedStream | null>(null)
  const summary = useMemo(() => buildTodaySummary(logs, idleLogs), [idleLogs, logs])
  const pendingIdleLog = useMemo(
    () =>
      idleLogs.find(
        (log) => !log.reviewed && !log.ignored && !postponedIdleIds.includes(log.id),
      ) ?? null,
    [idleLogs, postponedIdleIds],
  )
  const llmPayload = useMemo(() => buildLlmSummaryPayload(logs, idleLogs), [idleLogs, logs])
  const llmCacheSignature = useMemo(
    () => buildLlmCacheSignature(llmPayload, llmSettings),
    [llmPayload, llmSettings],
  )
  const flows = llmFlows ?? summary.flows

  useEffect(() => {
    let active = true

    async function loadLogs() {
      try {
        const [nextLogs, nextIdleLogs] = await Promise.all([getActivityLogs(), getIdleLogs()])

        if (active) {
          setLogs(nextLogs)
          setIdleLogs(nextIdleLogs)
          setError(null)
        }
      } catch {
        if (active) {
          setError("Не удалось загрузить активности")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    const interval = window.setInterval(loadLogs, 5000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadLlmSettings() {
      try {
        const settings = await getSettings()

        if (active) {
          setLlmSettings(readLlmSettings(settings))
        }
      } catch {
        if (active) {
          setLlmSettings(DEFAULT_LLM_SETTINGS)
        }
      }
    }

    void loadLlmSettings()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    setLlmFlows(null)
    setLlmCachedAt(null)
    setLlmError(null)

    async function loadCachedSummary() {
      if (llmPayload.items.length === 0) {
        return
      }

      try {
        const cachedSummary = await getLlmSummary({
          date_key: llmPayload.date,
          payload_signature: llmCacheSignature,
          provider: llmSettings.provider,
          model: llmSettings.model,
        })

        if (!active || !cachedSummary) {
          return
        }

        const groups = parseStoredLlmGroups(cachedSummary.groups_json)
        setLlmFlows(buildFlowsFromLlmGroups(llmPayload, groups))
        setLlmCachedAt(cachedSummary.created_at)
      } catch {
        if (active) {
          setLlmError("Не удалось загрузить сохраненную LLM-группировку")
        }
      }
    }

    void loadCachedSummary()

    return () => {
      active = false
    }
  }, [llmCacheSignature, llmPayload, llmSettings])

  async function generateLlmSummary() {
    setLlmLoading(true)
    setLlmError(null)

    try {
      const groups = await requestOllamaSummary(llmPayload, llmSettings)
      setLlmFlows(buildFlowsFromLlmGroups(llmPayload, groups))

      try {
        const savedSummary = await saveLlmSummary({
          date_key: llmPayload.date,
          payload_signature: llmCacheSignature,
          provider: llmSettings.provider,
          model: llmSettings.model,
          groups_json: serializeLlmGroups(groups),
        })
        setLlmCachedAt(savedSummary.created_at)
      } catch {
        setLlmError("Группировка получена, но не сохранена в SQLite")
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Не удалось получить ответ Ollama"
      setLlmError(`Ollama недоступна или модель не готова: ${message}`)
    } finally {
      setLlmLoading(false)
    }
  }

  async function reviewIdleLog(input: { ignored: boolean; note: string | null }) {
    if (!pendingIdleLog) {
      return
    }

    try {
      const updatedLog = await updateIdleLog(pendingIdleLog.id, {
        ignored: input.ignored,
        note: input.note,
        reviewed: true,
      })

      setIdleLogs((currentLogs) =>
        currentLogs.map((log) => (log.id === updatedLog.id ? updatedLog : log)),
      )
      setPostponedIdleIds((currentIds) => currentIds.filter((id) => id !== updatedLog.id))
      setIdleNote("")
    } catch {
      setError("Не удалось сохранить уточнение простоя")
    }
  }

  function postponeIdleReview() {
    if (!pendingIdleLog) {
      return
    }

    setPostponedIdleIds((currentIds) =>
      currentIds.includes(pendingIdleLog.id) ? currentIds : [...currentIds, pendingIdleLog.id],
    )
    setIdleNote("")
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <DayTimeline
        description={loading ? "Загружаю активности" : "Реальные интервалы из локальной базы"}
        items={summary.timeline}
        totalTime={summary.activeTime}
      />

      <section className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Фокус" value={summary.focusPercent} />
          <MetricCard label="Активно" value={summary.activeTime} />
          <MetricCard label="Простой" value={summary.idleTime} />
        </div>

        <LlmPrepCard
          cachedAt={llmCachedAt}
          error={llmError}
          loading={llmLoading}
          onGenerate={() => void generateLlmSummary()}
          payload={llmPayload}
          settings={llmSettings}
        />

        {flows.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-200 bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium">Потоки появятся после первых записей</p>
            <p className="mt-1 text-xs text-zinc-500">
              Сначала трекер соберет реальные активности, затем их можно сгруппировать через LLM.
            </p>
          </div>
        )}

        {flows.map((flow) => (
          <FlowCard
            flow={flow}
            key={flow.name}
            onStreamSelect={(nextFlow, stream) => setSelectedStream({ flow: nextFlow, stream })}
          />
        ))}
      </section>

      {pendingIdleLog && (
        <IdleReviewDialog
          idleLog={pendingIdleLog}
          note={idleNote}
          onIgnore={() => void reviewIdleLog({ ignored: true, note: null })}
          onNoteChange={setIdleNote}
          onPostpone={postponeIdleReview}
          onSave={() =>
            void reviewIdleLog({
              ignored: false,
              note: idleNote.trim() || null,
            })
          }
        />
      )}

      {selectedStream && (
        <StreamDetailsDialog
          selectedStream={selectedStream}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </div>
  )
}

type StreamDetailsDialogProps = {
  selectedStream: SelectedStream
  onClose: () => void
}

function StreamDetailsDialog({ selectedStream, onClose }: StreamDetailsDialogProps) {
  const details = selectedStream.stream.details ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4">
      <section className="relative max-h-[80vh] w-full max-w-xl overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xl">
        <Button
          aria-label="Закрыть"
          className="absolute right-3 top-3"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>

        <div className="border-b border-zinc-200 px-4 py-3 pr-12">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: selectedStream.flow.accent }} />
            <p className="text-xs text-zinc-500">{selectedStream.flow.name}</p>
          </div>
          <h2 className="mt-1 text-sm font-semibold">{selectedStream.stream.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {selectedStream.stream.time} · {selectedStream.stream.activities} активностей
          </p>
        </div>

        <div className="max-h-[56vh] overflow-y-auto divide-y divide-zinc-100">
          {details.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              Детали для этого стрима пока не сохранены
            </div>
          )}

          {details.map((activity, index) => (
            <div className="grid gap-1 px-4 py-3" key={`${activity.start}-${activity.app}-${index}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activity.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{activity.app}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-zinc-600">{activity.duration}</span>
              </div>
              <p className="text-xs text-zinc-500">
                {activity.start} - {activity.end}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

type IdleReviewDialogProps = {
  idleLog: IdleLogRecord
  note: string
  onIgnore: () => void
  onNoteChange: (note: string) => void
  onPostpone: () => void
  onSave: () => void
}

function IdleReviewDialog({
  idleLog,
  note,
  onIgnore,
  onNoteChange,
  onPostpone,
  onSave,
}: IdleReviewDialogProps) {
  const start = formatTime(idleLog.start_time)
  const end = formatTime(idleLog.end_time)
  const duration = formatMinutes(durationMinutes(idleLog.start_time, idleLog.end_time))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4">
      <section className="relative w-full max-w-md rounded-md border border-zinc-200 bg-white p-4 shadow-xl">
        <Button
          aria-label="Закрыть"
          className="absolute right-3 top-3"
          onClick={onPostpone}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
        <div>
          <h2 className="text-sm font-semibold">Уточнить простой</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Зафиксирован перерыв с {start} до {end}, {duration}.
          </p>
        </div>

        <textarea
          className="mt-4 min-h-24 w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Например: обед, звонок, дорога"
          value={note}
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onPostpone} type="button" variant="ghost">
            Позже
          </Button>
          <Button onClick={onIgnore} type="button" variant="outline">
            Игнорировать
          </Button>
          <Button onClick={onSave} type="button">
            Сохранить
          </Button>
        </div>
      </section>
    </div>
  )
}

function durationMinutes(startTime: string, endTime: string) {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return (end - start) / 60_000
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
