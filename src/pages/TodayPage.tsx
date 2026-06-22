import { useEffect, useMemo, useState } from "react"

import { DayTimeline } from "@/components/dashboard/DayTimeline"
import { FlowCard } from "@/components/dashboard/FlowCard"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { buildTodaySummary } from "@/lib/activity-analytics"
import { getActivityLogs, type ActivityLogRecord } from "@/lib/focusflow-api"

export function TodayPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const summary = useMemo(() => buildTodaySummary(logs), [logs])

  useEffect(() => {
    let active = true

    async function loadLogs() {
      try {
        const nextLogs = await getActivityLogs()

        if (active) {
          setLogs(nextLogs)
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
    </div>
  )
}
