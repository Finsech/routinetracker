import { useEffect, useMemo, useState } from "react"

import { Heatmap } from "@/components/dashboard/Heatmap"
import { WeekTimeline } from "@/components/dashboard/WeekTimeline"
import { buildHistorySummary } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"

export function HistoryPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const summary = useMemo(() => buildHistorySummary(logs, idleLogs), [idleLogs, logs])

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
          setError("Не удалось загрузить недельную историю")
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
    <div className="space-y-5">
      {error && (
        <div className="rounded-[20px] border border-[#F0D1D1] bg-[#FFF4F4] px-4 py-3 text-sm text-[#9C4E4E]">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-[22px] border border-white/80 bg-white/75 px-4 py-3 text-sm text-[#667A6F] shadow-[0_14px_40px_rgba(91,121,108,0.06)]">
          Собираю недельную картину активности.
        </div>
      )}

      <WeekTimeline days={summary.weekDays} />
      <Heatmap cells={summary.heatmap} months={summary.heatmapMonths} totalHours={summary.totalHours} />
    </div>
  )
}
