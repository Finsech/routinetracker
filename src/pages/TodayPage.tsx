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
  getSettings,
  updateIdleLog,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"
import {
  DEFAULT_LLM_SETTINGS,
  buildFlowsFromLlmGroups,
  buildLlmSummaryPayload,
  readLlmSettings,
  requestOllamaSummary,
  type LlmProviderSettings,
} from "@/lib/llm-summary"
import type { FlowSummary } from "@/types"

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
  const summary = useMemo(() => buildTodaySummary(logs, idleLogs), [idleLogs, logs])
  const pendingIdleLog = useMemo(
    () =>
      idleLogs.find(
        (log) => !log.reviewed && !log.ignored && !postponedIdleIds.includes(log.id),
      ) ?? null,
    [idleLogs, postponedIdleIds],
  )
  const llmPayload = useMemo(() => buildLlmSummaryPayload(logs, idleLogs), [idleLogs, logs])
  const llmPayloadKey = useMemo(
    () =>
      [
        llmPayload.date,
        llmPayload.activity_count,
        llmPayload.idle_count,
        llmPayload.total_active_minutes,
        llmPayload.total_idle_minutes,
      ].join(":"),
    [llmPayload],
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
    setLlmFlows(null)
    setLlmError(null)
  }, [llmPayloadKey])

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

  async function generateLlmSummary() {
    setLlmLoading(true)
    setLlmError(null)

    try {
      const groups = await requestOllamaSummary(llmPayload, llmSettings)
      setLlmFlows(buildFlowsFromLlmGroups(llmPayload, groups))
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
          <FlowCard flow={flow} key={flow.name} />
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
