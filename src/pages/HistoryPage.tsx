import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowRightLeft, CalendarRange, Clock3 } from "lucide-react"

import { Heatmap } from "@/components/dashboard/Heatmap"
import { WeekTimeline } from "@/components/dashboard/WeekTimeline"
import { buildHistorySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"
import type { TimelineItem, WeekTimelineDay } from "@/types"

type SelectedWeekItem = {
  day: WeekTimelineDay
  item: TimelineItem
}

export function HistoryPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedWeekItem | null>(null)
  const summary = useMemo(() => buildHistorySummary(logs, idleLogs), [idleLogs, logs])

  useEffect(() => {
    let active = true

    async function loadLogs() {
      try {
        const [nextLogs, nextIdleLogs] = await Promise.all([getActivityLogs(), getIdleLogs()])

        if (!active) {
          return
        }

        setLogs(nextLogs)
        setIdleLogs(nextIdleLogs)
        setError(null)
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

  useEffect(() => {
    if (!selectedDayKey && summary.weekDays[0]) {
      setSelectedDayKey(summary.weekDays[0].dateKey)
    }
  }, [selectedDayKey, summary.weekDays])

  const selectedDay =
    summary.weekDays.find((day) => day.dateKey === selectedDayKey) ?? summary.weekDays[0] ?? null
  const selectedItemId = selectedItem
    ? `${selectedItem.day.dateKey}-${selectedItem.item.startMinutes}-${selectedItem.item.endMinutes}-${selectedItem.item.label}-${selectedItem.day.items.findIndex((item) => item === selectedItem.item)}`
    : null
  const busiestDay = useMemo(
    () =>
      [...summary.weekDays].sort((left, right) => right.totalMinutes - left.totalMinutes)[0] ?? null,
    [summary.weekDays],
  )
  const totalSwitches = useMemo(
    () =>
      summary.weekDays.reduce((sum, day) => sum + countContextSwitches(day.items), 0),
    [summary.weekDays],
  )
  const totalTrackedMinutes = useMemo(
    () => summary.weekDays.reduce((sum, day) => sum + day.totalMinutes, 0),
    [summary.weekDays],
  )
  const longestItem = useMemo(() => {
    const allItems = summary.weekDays.flatMap((day) =>
      day.items.map((item) => ({ day, item })),
    )
    return allItems.sort((left, right) => right.item.durationMinutes - left.item.durationMinutes)[0] ?? null
  }, [summary.weekDays])
  const rangeLabel = selectedDay
    ? `${formatWeekDate(summary.weekDays[0]?.dateKey)} - ${formatWeekDate(summary.weekDays[summary.weekDays.length - 1]?.dateKey)}`
    : "Неделя пока пуста"

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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <WeekTimeline
          days={summary.weekDays}
          onDaySelect={(day) => {
            setSelectedDayKey(day.dateKey)
            setSelectedItem(null)
          }}
          onItemSelect={(day, item) => {
            setSelectedDayKey(day.dateKey)
            setSelectedItem({ day, item })
          }}
          selectedDayKey={selectedDay?.dateKey ?? null}
          selectedItemId={selectedItemId}
        />

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
            {!selectedItem && selectedDay ? (
              <>
                <p className="font-['Georgia'] text-[1.8rem] text-[#24382F]">Ритм недели</p>
                <p className="mt-2 text-sm leading-6 text-[#6F8177]">{rangeLabel}</p>

                <div className="mt-5 space-y-3">
                  <InsightMetric label="Всего" value={formatMinutes(totalTrackedMinutes)} />
                  <InsightMetric
                    label="Самый плотный день"
                    value={
                      busiestDay
                        ? `${busiestDay.shortLabel} ${busiestDay.dayNumber}`
                        : "Пока нет"
                    }
                  />
                  <InsightMetric
                    label="Переключения"
                    value={`${totalSwitches}`}
                  />
                </div>

                <div className="mt-5 rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
                  <div className="flex items-center gap-2 text-[#6E8176]">
                    <CalendarRange className="size-4" />
                    <span className="text-sm">Выбранный день</span>
                  </div>
                  <p className="mt-3 text-[1.35rem] font-medium text-[#274034]">
                    {selectedDay.shortLabel} {selectedDay.dayNumber}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#7A8C83]">
                    {selectedDay.items.length} интервалов, {formatMinutes(selectedDay.totalMinutes)} активности.
                  </p>
                </div>

                {longestItem && (
                  <div className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
                    <div className="flex items-center gap-2 text-[#6E8176]">
                      <Clock3 className="size-4" />
                      <span className="text-sm">Самый длинный интервал</span>
                    </div>
                    <p className="mt-3 text-[1.1rem] font-medium text-[#274034]">
                      {longestItem.item.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#7A8C83]">
                      {formatMinutes(longestItem.item.durationMinutes)} в {longestItem.day.shortLabel.toLowerCase()} {longestItem.day.dayNumber}.
                    </p>
                  </div>
                )}
              </>
            ) : selectedItem ? (
              <WeekItemInspector item={selectedItem.item} day={selectedItem.day} onReset={() => setSelectedItem(null)} />
            ) : null}
          </section>
        </aside>
      </section>

      <Heatmap cells={summary.heatmap} months={summary.heatmapMonths} totalHours={summary.totalHours} />
    </div>
  )
}

function WeekItemInspector({
  day,
  item,
  onReset,
}: {
  day: WeekTimelineDay
  item: TimelineItem
  onReset: () => void
}) {
  return (
    <div>
      <button
        className="inline-flex items-center gap-2 text-sm text-[#6C7E74] transition hover:text-[#273E31]"
        onClick={onReset}
        type="button"
      >
        <ArrowRight className="size-4 rotate-180" />
        Назад к обзору недели
      </button>

      <div className="mt-4 flex items-center gap-2 text-[#6F8177]">
        <ArrowRightLeft className="size-4" />
        <span className="text-sm">
          {day.shortLabel} {day.dayNumber}
        </span>
      </div>

      <p className="mt-3 font-['Georgia'] text-[1.65rem] leading-tight text-[#24382F]">{item.label}</p>

      <div className="mt-4 space-y-3">
        <InsightMetric label="Время" value={`${item.start} - ${item.end}`} />
        <InsightMetric label="Длительность" value={formatMinutes(item.durationMinutes)} />
        <InsightMetric label="Источник" value={item.app} />
        <InsightMetric label="Тип" value={item.kind === "idle" ? "Простой" : "Активность"} />
      </div>

      {item.url && (
        <div className="mt-4 rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
          <p className="text-sm text-[#73867A]">URL</p>
          <p className="mt-2 break-all text-sm leading-6 text-[#2B4236]">{item.url}</p>
        </div>
      )}
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <p className="text-sm text-[#73867A]">{label}</p>
      <p className="mt-2 text-[1.15rem] font-medium text-[#253D31]">{value}</p>
    </div>
  )
}

function countContextSwitches(items: TimelineItem[]) {
  const activityItems = items.filter((item) => item.kind === "activity")
  return activityItems.reduce((count, item, index) => {
    if (index === 0) {
      return count
    }

    return activityItems[index - 1]?.app !== item.app ? count + 1 : count
  }, 0)
}

function formatWeekDate(dateKey?: string) {
  if (!dateKey) {
    return ""
  }

  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })
}
