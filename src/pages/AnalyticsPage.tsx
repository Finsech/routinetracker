import { useEffect, useMemo, useState } from "react"

import { FocusDonut } from "@/components/dashboard/FocusDonut"
import { buildTodaySummary } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"

const ANALYTICS_COLORS = ["#7CB39A", "#86B8E5", "#B89BE8", "#F2B880", "#D97D6B"]

export function AnalyticsPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const summary = useMemo(() => buildTodaySummary(logs, idleLogs), [idleLogs, logs])

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [nextLogs, nextIdleLogs] = await Promise.all([getActivityLogs(), getIdleLogs()])

        if (active) {
          setLogs(nextLogs)
          setIdleLogs(nextIdleLogs)
          setError(null)
        }
      } catch {
        if (active) {
          setError("Не удалось собрать аналитику за день")
        }
      }
    }

    void loadData()
    const interval = window.setInterval(loadData, 10000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const segments = buildSegments(summary)
  const longestStream = summary.flows.flatMap((flow) => flow.streams).sort(byMinutesDesc)[0] ?? null

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-[20px] border border-[#F0D1D1] bg-[#FFF4F4] px-4 py-3 text-sm text-[#9C4E4E]">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-[420px]">
            <p className="font-['Georgia'] text-[2rem] leading-none text-[#24382F]">Аналитика дня</p>
            <p className="mt-3 text-sm leading-6 text-[#6C7E74]">
              Здесь живет нейросводка и читаемая картина дня: куда ушло время, что было
              главным фокусом и где чаще всего происходили переключения.
            </p>
          </div>

          <div className="min-w-[260px] flex-1">
            <FocusDonut centerLabel="Итого" centerValue={summary.activeTime} segments={segments} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <p className="font-['Georgia'] text-[1.7rem] text-[#24382F]">Нейросводка</p>
          <div className="mt-5 grid gap-3">
            <SummaryLine
              label="Фокус"
              value={summary.focusPercent}
              hint="Доля активного времени в общем ритме дня."
            />
            <SummaryLine
              label="Активно"
              value={summary.activeTime}
              hint="Чистое время в приложениях и сайтах."
            />
            <SummaryLine
              label="Простой"
              value={summary.idleTime}
              hint="Перерывы и паузы без ввода."
            />
            <SummaryLine
              label="Главный стрим"
              value={longestStream?.name ?? "Пока нет"}
              hint={longestStream ? longestStream.time : "Стримы появятся после группировки или первых логов."}
            />
          </div>
        </article>

        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <p className="font-['Georgia'] text-[1.7rem] text-[#24382F]">Потоки дня</p>
          <div className="mt-5 space-y-3">
            {summary.flows.length === 0 && (
              <p className="text-sm text-[#75877D]">
                Когда появятся сгруппированные потоки, здесь будет видно их вклад в день.
              </p>
            )}

            {summary.flows.map((flow) => (
              <div
                className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3"
                key={flow.name}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: flow.accent }} />
                    <span className="font-medium text-[#2B4236]">{flow.name}</span>
                  </div>
                  <span className="text-sm text-[#62756A]">{flow.time}</span>
                </div>
                <p className="mt-2 text-sm text-[#7A8C83]">{flow.streams.length} стримов за день</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function buildSegments(summary: ReturnType<typeof buildTodaySummary>) {
  if (summary.flows.length === 0) {
    return [{ label: "Активность", value: 100, color: ANALYTICS_COLORS[0] }]
  }

  const totalMinutes = Math.max(
    1,
    summary.flows.reduce((sum, flow) => sum + parseDuration(flow.time), 0),
  )

  return summary.flows.map((flow, index) => ({
    label: flow.name,
    value: Math.max(1, Math.round((parseDuration(flow.time) / totalMinutes) * 100)),
    color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
  }))
}

function parseDuration(value: string) {
  const hoursMatch = value.match(/(\d+)\s*ч/)
  const minutesMatch = value.match(/(\d+)\s*мин/)
  return Number(hoursMatch?.[1] ?? 0) * 60 + Number(minutesMatch?.[1] ?? 0)
}

function byMinutesDesc(
  left: { time: string },
  right: { time: string },
) {
  return parseDuration(right.time) - parseDuration(left.time)
}

function SummaryLine({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#6F8278]">{label}</span>
        <span className="font-medium text-[#284135]">{value}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#7E8F86]">{hint}</p>
    </div>
  )
}
