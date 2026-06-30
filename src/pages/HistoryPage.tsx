import { useEffect, useMemo, useState } from "react"
import { CalendarRange, Clock3 } from "lucide-react"

import { StateCard } from "@/components/app/StateCard"
import { Heatmap } from "@/components/dashboard/Heatmap"
import { UI_ERROR_COPY } from "@/lib/copy/errors"
import {
  WeekTimeline,
  buildWeekTimelineDayBar,
} from "@/components/dashboard/WeekTimeline"
import { buildHistorySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"

export function HistoryPage({ selectedDate }: { selectedDate: Date }) {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const summary = useMemo(
    () => buildHistorySummary(logs, idleLogs, selectedDate),
    [idleLogs, logs, selectedDate],
  )

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
          setError(UI_ERROR_COPY.history.loadWeek)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    const interval = window.setInterval(loadLogs, 10000)

    function handleResume() {
      if (document.visibilityState === "visible") {
        void loadLogs()
      }
    }

    window.addEventListener("focus", handleResume)
    document.addEventListener("visibilitychange", handleResume)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener("focus", handleResume)
      document.removeEventListener("visibilitychange", handleResume)
    }
  }, [])

  const selectedDay =
    summary.weekDays.find((day) => day.dateKey === selectedDayKey) ?? null
  const selectedDayBar = useMemo(
    () => (selectedDay ? buildWeekTimelineDayBar(selectedDay) : null),
    [selectedDay],
  )
  const weekContextBar = useMemo(
    () =>
      buildWeekTimelineDayBar({
        dateKey: "week",
        label: "Неделя",
        shortLabel: "Нед",
        dayNumber: "",
        totalMinutes: summary.weekDays.reduce((sum, day) => sum + day.totalMinutes, 0),
        items: summary.weekDays.flatMap((day) => day.items),
      }),
    [summary.weekDays],
  )
  const busiestDay = useMemo(
    () =>
      [...summary.weekDays].sort((left, right) => right.totalMinutes - left.totalMinutes)[0] ??
      null,
    [summary.weekDays],
  )
  const totalSwitches = useMemo(
    () => summary.weekDays.reduce((sum, day) => sum + countContextSwitches(day.items), 0),
    [summary.weekDays],
  )
  const totalTrackedMinutes = useMemo(
    () => summary.weekDays.reduce((sum, day) => sum + day.totalMinutes, 0),
    [summary.weekDays],
  )
  const longestItem = useMemo(() => {
    const allItems = summary.weekDays.flatMap((day) => day.items.map((item) => ({ day, item })))
    return (
      allItems.sort((left, right) => right.item.durationMinutes - left.item.durationMinutes)[0] ??
      null
    )
  }, [summary.weekDays])
  const selectedDaySwitches = useMemo(
    () => (selectedDay ? countContextSwitches(selectedDay.items) : 0),
    [selectedDay],
  )
  const selectedDayLongestItem = useMemo(() => {
    if (!selectedDay) {
      return null
    }

    return [...selectedDay.items].sort((left, right) => right.durationMinutes - left.durationMinutes)[0] ?? null
  }, [selectedDay])
  const rangeLabel =
    summary.weekDays.length > 0
      ? `${formatWeekDate(summary.weekDays[0]?.dateKey)} - ${formatWeekDate(
          summary.weekDays[summary.weekDays.length - 1]?.dateKey,
        )}`
      : "Неделя пока пустая"
  const activeMetricLabel = selectedDay ? "Выбранный день" : "Фокус периода"
  const activeMetricValue = selectedDay
    ? `${selectedDay.shortLabel} ${selectedDay.dayNumber}`
    : busiestDay
      ? `${busiestDay.shortLabel} ${busiestDay.dayNumber}`
      : "Вся неделя"
  const activeMetricHint = selectedDay
    ? `${selectedDay.items.length} интервалов, ${formatMinutes(selectedDay.totalMinutes)} активности.`
    : `${summary.weekDays.reduce((sum, day) => sum + day.items.length, 0)} интервалов, ${formatMinutes(totalTrackedMinutes)} активности.`
  const activeLongestItem = selectedDay
    ? selectedDayLongestItem
      ? { item: selectedDayLongestItem, day: selectedDay }
      : null
    : longestItem
  const headline = selectedDay
    ? buildDayHeadline(selectedDay.totalMinutes, selectedDaySwitches, selectedDayLongestItem?.label ?? null)
    : buildWeekHeadline(totalTrackedMinutes, busiestDay?.label ?? null, totalSwitches)

  return (
    <div className="space-y-4">
      {error && (
        <StateCard
          description="Не получилось собрать недельную картину из локальных логов. Можно попробовать еще раз через пару секунд."
          title={error}
          variant="error"
        />
      )}

      {loading && (
        <StateCard
          description="Подтягиваю интервалы активности и пересчитываю ритм выбранной недели."
          title="Собираю недельную картину активности"
          variant="loading"
        />
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <WeekTimeline
          days={summary.weekDays}
          onDaySelect={(day) => {
            setSelectedDayKey((current) => (current === day.dateKey ? null : day.dateKey))
          }}
          selectedDayKey={selectedDay?.dateKey ?? null}
        />

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
            <p className="font-['Georgia'] text-[1.7rem] text-[#24382F]">
              {selectedDay ? "День в фокусе" : "Ритм недели"}
            </p>
            <p className="mt-1.5 text-[13px] leading-6 text-[#6F8177]">
              {selectedDay
                ? `${selectedDay.label}. Клик по тому же дню снимет фокус и вернет общий weekly overview.`
                : rangeLabel}
            </p>

            <div className="mt-4 grid gap-2.5">
              <InsightMetric
                label="Всего"
                value={formatMinutes(selectedDay ? selectedDay.totalMinutes : totalTrackedMinutes)}
              />
              <InsightMetric
                label={selectedDay ? "Контекст-переключения" : "Самый плотный день"}
                value={
                  selectedDay
                    ? `${selectedDaySwitches}`
                    : busiestDay
                      ? `${busiestDay.shortLabel} ${busiestDay.dayNumber}`
                      : "Пока нет"
                }
              />
              <InsightMetric
                label={selectedDay ? "Эпизоды" : "Переключения"}
                value={selectedDay ? `${selectedDay.items.length}` : `${totalSwitches}`}
              />
            </div>

            <div className="mt-4 rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
              <div className="flex items-center gap-2 text-[#6E8176]">
                <CalendarRange className="size-4" />
                <span className="text-[13px]">{activeMetricLabel}</span>
              </div>
              <p className="mt-2.5 text-[1.2rem] font-medium text-[#274034]">
                {activeMetricValue}
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-[#7A8C83]">
                {activeMetricHint}
              </p>
            </div>

            {activeLongestItem && (
              <div className="mt-4 rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
                <div className="flex items-center gap-2 text-[#6E8176]">
                  <Clock3 className="size-4" />
                  <span className="text-[13px]">Самый длинный интервал</span>
                </div>
                <p className="mt-2.5 text-[1rem] font-medium text-[#274034]">
                  {activeLongestItem.item.label}
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-[#7A8C83]">
                  {formatMinutes(activeLongestItem.item.durationMinutes)} в{" "}
                  {activeLongestItem.day.shortLabel.toLowerCase()} {activeLongestItem.day.dayNumber}.
                </p>
              </div>
            )}

            <div className="mt-4 rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
              <p className="text-[13px] text-[#6E8176]">Короткий вывод</p>
              <p className="mt-2 text-sm leading-6 text-[#50655A]">{headline}</p>
            </div>
          </section>
        </aside>
      </section>

      {(selectedDayBar ?? weekContextBar).segments.length > 0 && (
        <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-['Georgia'] text-[1.65rem] text-[#24382F]">
                {selectedDay ? "Контексты дня" : "Контексты недели"}
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-[#6F8177]">
                {selectedDay
                  ? "Состав выбранного дня вынесен отдельно, чтобы не перегружать блок ритма недели."
                  : "Пока день не выбран, здесь собран общий срез недели по приложениям и сайтам."}
              </p>
            </div>
            <div className="rounded-full border border-[#E3ECE5] bg-[#FBFDFB] px-3 py-1 text-[12px] text-[#667A6E]">
              {selectedDay ? `${selectedDay.shortLabel} ${selectedDay.dayNumber}` : "Вся неделя"}
            </div>
          </div>

          <div className="mt-4 h-[450px] overflow-y-auto rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] p-3">
            <div className="space-y-3">
              {(selectedDayBar ?? weekContextBar).segments.map((segment) => (
                <div
                  className="rounded-[20px] border border-[#E3ECE5] bg-white px-4 py-3"
                  key={segment.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: segment.accent }}
                      />
                      <p className="truncate text-sm font-medium text-[#273E31]">
                        {segment.label}
                      </p>
                    </div>
                    <span className="text-sm text-[#62756A]">
                      {formatMinutes(segment.durationMinutes)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7B8D84]">{segment.episodes} эпизодов</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Heatmap
        cells={summary.heatmap}
        months={summary.heatmapMonths}
        totalHours={summary.totalHours}
      />
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <p className="text-[13px] text-[#73867A]">{label}</p>
      <p className="mt-1.5 text-[1.05rem] font-medium text-[#253D31]">{value}</p>
    </div>
  )
}

function buildWeekHeadline(
  totalTrackedMinutes: number,
  busiestDayLabel: string | null,
  totalSwitches: number,
) {
  if (totalTrackedMinutes === 0) {
    return "Неделя пока почти пустая: как только появится больше активности, здесь сложится внятная картина ритма."
  }

  if (!busiestDayLabel) {
    return `За неделю уже накопилось ${formatMinutes(totalTrackedMinutes)} активности.`
  }

  if (totalSwitches <= 3) {
    return `Неделя выглядит довольно цельной: основной вес пришелся на ${busiestDayLabel}, а заметных переключений контекста было немного.`
  }

  return `Самый плотный день — ${busiestDayLabel}. По неделе видно ${totalSwitches} заметных переключений контекста, так что ритм был скорее дробным.`
}

function buildDayHeadline(
  totalTrackedMinutes: number,
  contextSwitches: number,
  longestLabel: string | null,
) {
  if (totalTrackedMinutes === 0) {
    return "В этот день пока почти нет данных: как только появится больше активности, здесь станет видно, из чего сложился ритм."
  }

  if (!longestLabel) {
    return `В выбранном дне уже есть ${formatMinutes(totalTrackedMinutes)} активности и ${contextSwitches} заметных переключений контекста.`
  }

  if (contextSwitches <= 2) {
    return `День выглядит цельным: самым длинным отрезком был «${longestLabel}», а переключений контекста осталось совсем немного.`
  }

  return `День получился дробным: «${longestLabel}» был самым длинным отрезком, но параллельно накопилось ${contextSwitches} заметных переключений контекста.`
}

function countContextSwitches(items: { app: string; kind: "activity" | "idle" }[]) {
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
