import { useEffect, useMemo, useState } from "react"

import { Heatmap } from "@/components/dashboard/Heatmap"
import { WeekTimeline } from "@/components/dashboard/WeekTimeline"
import { buildHistorySummary } from "@/lib/activity-analytics"
import { getActivityLogs, type ActivityLogRecord } from "@/lib/focusflow-api"

export function HistoryPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const summary = useMemo(() => buildHistorySummary(logs), [logs])

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
          setError("Не удалось загрузить историю")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    const interval = window.setInterval(loadLogs, 10000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
          Загружаю историю активности
        </div>
      )}

      <Heatmap levels={summary.heatmapLevels} totalHours={summary.totalHours} />
      <WeekTimeline items={summary.week} />
    </div>
  )
}
