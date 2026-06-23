import { useEffect, useMemo, useState } from "react"

import { DayTimeline } from "@/components/dashboard/DayTimeline"
import { FlowCard } from "@/components/dashboard/FlowCard"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Button } from "@/components/ui/button"
import { buildTodaySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  updateIdleLog,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"

export function TodayPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [idleNote, setIdleNote] = useState("")
  const summary = useMemo(() => buildTodaySummary(logs, idleLogs), [idleLogs, logs])
  const pendingIdleLog = useMemo(
    () => idleLogs.find((log) => !log.reviewed && !log.ignored) ?? null,
    [idleLogs],
  )

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
      setIdleNote("")
    } catch {
      setError("Не удалось сохранить уточнение простоя")
    }
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

        {summary.flows.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-200 bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium">Потоки появятся после первых записей</p>
            <p className="mt-1 text-xs text-zinc-500">
              Пока LLM не подключена, реальные активности группируются по приложениям.
            </p>
          </div>
        )}

        {summary.flows.map((flow) => (
          <FlowCard flow={flow} key={flow.name} />
        ))}
      </section>

      {pendingIdleLog && (
        <IdleReviewDialog
          idleLog={pendingIdleLog}
          note={idleNote}
          onIgnore={() => void reviewIdleLog({ ignored: true, note: null })}
          onNoteChange={setIdleNote}
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
  onSave: () => void
}

function IdleReviewDialog({
  idleLog,
  note,
  onIgnore,
  onNoteChange,
  onSave,
}: IdleReviewDialogProps) {
  const start = formatTime(idleLog.start_time)
  const end = formatTime(idleLog.end_time)
  const duration = formatMinutes(durationMinutes(idleLog.start_time, idleLog.end_time))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4">
      <section className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-4 shadow-xl">
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
