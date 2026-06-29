import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, Focus, Sparkles } from "lucide-react"

import { StateCard } from "@/components/app/StateCard"
import { FocusDonut } from "@/components/dashboard/FocusDonut"
import { buildTodaySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  getLlmSummaries,
  getSettings,
  type ActivityLogRecord,
  type IdleLogRecord,
  type LlmSummaryRecord,
  type SettingEntryRecord,
} from "@/lib/focusflow-api"
import {
  buildFlowsFromLlmGroups,
  buildLlmCacheSignature,
  buildLlmSummaryPayload,
  parseStoredLlmGroups,
  readLlmSettings,
} from "@/lib/llm-summary"
import type { FlowSummary, TimelineItem } from "@/types"

const ANALYTICS_COLORS = ["#7CB39A", "#86B8E5", "#B89BE8", "#F2B880", "#D97D6B"]

export function AnalyticsPage({ selectedDate }: { selectedDate: Date }) {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [llmSummaries, setLlmSummaries] = useState<LlmSummaryRecord[]>([])
  const [settings, setSettings] = useState<SettingEntryRecord[]>([])
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(selectedDate))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [nextLogs, nextIdleLogs, nextSettings, nextLlmSummaries] = await Promise.all([
          getActivityLogs(),
          getIdleLogs(),
          getSettings(),
          getLlmSummaries(),
        ])

        if (!active) {
          return
        }

        setLogs(nextLogs)
        setIdleLogs(nextIdleLogs)
        setSettings(nextSettings)
        setLlmSummaries(nextLlmSummaries)
        setError(null)

        const availableDateKeys = buildAvailableDateKeys(nextLogs, nextIdleLogs)
        setSelectedDateKey((current) => current ?? availableDateKeys[0] ?? formatDateKey(selectedDate))
      } catch {
        if (active) {
          setError("Не удалось собрать аналитику по дням")
        }
      }
    }

    void loadData()
    const interval = window.setInterval(loadData, 10000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [selectedDate])

  const availableDateKeys = useMemo(
    () => buildAvailableDateKeys(logs, idleLogs),
    [idleLogs, logs],
  )
  const availableDateSet = useMemo(() => new Set(availableDateKeys), [availableDateKeys])
  const effectiveDateKey = selectedDateKey ?? availableDateKeys[0] ?? formatDateKey(selectedDate)
  const selectedDay = useMemo(() => parseDateKey(effectiveDateKey), [effectiveDateKey])
  const summary = useMemo(
    () => buildTodaySummary(logs, idleLogs, selectedDay),
    [idleLogs, logs, selectedDay],
  )
  const llmSettings = useMemo(() => readLlmSettings(settings), [settings])

  useEffect(() => {
    setSelectedDateKey(formatDateKey(selectedDate))
    setPickerMonth(startOfMonth(selectedDate))
  }, [selectedDate])
  const llmPayload = useMemo(
    () => buildLlmSummaryPayload(logs, idleLogs, selectedDay),
    [idleLogs, logs, selectedDay],
  )
  const llmCacheSignature = useMemo(
    () => buildLlmCacheSignature(llmPayload, llmSettings),
    [llmPayload, llmSettings],
  )
  const llmFlows = useMemo(
    () => resolveLlmFlows(llmSummaries, llmPayload, llmSettings, llmCacheSignature),
    [llmCacheSignature, llmPayload, llmSettings, llmSummaries],
  )
  const flows = llmFlows ?? summary.flows
  const segments = useMemo(() => buildSegments(flows), [flows])
  const insights = useMemo(() => buildInsights(summary.timeline, flows), [flows, summary.timeline])
  const longestStream = useMemo(
    () => flows.flatMap((flow) => flow.streams).sort(byMinutesDesc)[0] ?? null,
    [flows],
  )
  const topFlow = flows[0] ?? null
  const focusMinutes = parseDuration(summary.activeTime)
  const idleMinutes = parseDuration(summary.idleTime)

  return (
    <div className="space-y-5">
      {error && (
        <StateCard
          description="Не получилось собрать обзор по выбранным дням. Скорее всего, не дочитались локальные логи или сохраненные LLM-сводки."
          title={error}
          variant="error"
        />
      )}

      <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-[540px]">
            <p className="font-['Georgia'] text-[2rem] leading-none text-[#24382F]">Аналитика</p>
            <p className="mt-3 text-sm leading-6 text-[#6C7E74]">
              Спокойная сводка по выбранному дню: фокус, потоки, переключения контекста и короткие выводы без технического шума.
            </p>
          </div>

          <div className="relative">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#DDE8DF] bg-white px-4 py-2 text-sm text-[#30463A] transition hover:border-[#C9DDD0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBE3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF8]"
              onClick={() => setPickerOpen((current) => !current)}
              type="button"
            >
              <CalendarDays className="size-4" />
              {formatDatePill(effectiveDateKey)}
            </button>

            {pickerOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[320px] rounded-[24px] border border-[#DDE8DF] bg-white p-4 shadow-[0_22px_60px_rgba(91,121,108,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-full border border-[#E3ECE5] bg-[#FBFDFB] text-[#4A6155] transition hover:border-[#CADDD0]"
                    onClick={() => setPickerMonth((current) => addMonths(current, -1))}
                    type="button"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="text-sm font-medium text-[#2A4135]">
                    {pickerMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                  </div>
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-full border border-[#E3ECE5] bg-[#FBFDFB] text-[#4A6155] transition hover:border-[#CADDD0]"
                    onClick={() => setPickerMonth((current) => addMonths(current, 1))}
                    type="button"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] text-[#7A8C83]">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label) => (
                    <div key={label}>{label}</div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {buildCalendarCells(pickerMonth).map((cell, index) => {
                    if (!cell) {
                      return <div className="h-10" key={`empty-${index}`} />
                    }

                    const dateKey = formatDateKey(cell)
                    const tracked = availableDateSet.has(dateKey)
                    const active = dateKey === effectiveDateKey

                    return (
                      <button
                        className={`relative h-10 rounded-[14px] border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBE3D4] ${
                          active
                            ? "border-[#B7D9C0] bg-[#ECF7EF] text-[#284135]"
                            : tracked
                              ? "border-[#DCE8DF] bg-[#FBFDFB] text-[#32483C] hover:border-[#C9DDD0]"
                              : "border-transparent bg-transparent text-[#A5B3AC]"
                        }`}
                        disabled={!tracked}
                        key={dateKey}
                        onClick={() => {
                          setSelectedDateKey(dateKey)
                          setPickerOpen(false)
                        }}
                        type="button"
                      >
                        {cell.getDate()}
                        {tracked && (
                          <span className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#59B66F]" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-[300px]">
              <p className="font-['Georgia'] text-[1.75rem] text-[#24382F]">
                {formatAnalyticsHeading(effectiveDateKey)}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#72857A]">
                {buildHeadline(topFlow, longestStream, summary.focusPercent)}
              </p>
              <div className="mt-4 inline-flex items-center rounded-full border border-[#E3ECE5] bg-[#FBFDFB] px-3 py-1.5 text-xs text-[#6E8176]">
                {flows.length > 0 ? `${flows.length} потоков в обзоре` : "Сводка строится из локальных логов"}
              </div>
            </div>

            <div className="min-w-[250px] flex-1">
              <FocusDonut centerLabel="Активно" centerValue={summary.activeTime} segments={segments} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Focus} label="Фокус" value={summary.focusPercent} />
            <MetricCard icon={Clock3} label="Активно" value={summary.activeTime} />
            <MetricCard icon={Sparkles} label="Простой" value={summary.idleTime} />
            <MetricCard
              icon={ArrowRightLeft}
              label="Переключения"
              value={`${insights.contextSwitches}`}
            />
          </div>
        </article>

        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <p className="font-['Georgia'] text-[1.65rem] text-[#24382F]">Картина дня</p>
          <div className="mt-5 space-y-3">
            <SummaryLine
              label="Главный поток"
              value={topFlow?.name ?? "Пока не определился"}
              hint={topFlow ? `Доля дня: ${topFlow.time}.` : "Когда появится больше данных, здесь станет видно, куда ушло основное время."}
            />
            <SummaryLine
              label="Самый длинный стрим"
              value={longestStream?.name ?? "Пока нет"}
              hint={longestStream ? `${longestStream.time} непрерывного времени.` : "Стримы появятся после группировки или первых логов."}
            />
            <SummaryLine
              label="Ритм дня"
              value={buildRhythmValue(focusMinutes, idleMinutes)}
              hint={buildRhythmHint(summary.activeTime, summary.idleTime, insights.contextSwitches)}
            />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <p className="font-['Georgia'] text-[1.7rem] text-[#24382F]">Выводы</p>
          <div className="mt-5 space-y-3">
            {insights.lines.map((line) => (
              <div
                className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3 text-sm leading-6 text-[#4D6258]"
                key={line}
              >
                {line}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-['Georgia'] text-[1.7rem] text-[#24382F]">Потоки дня</p>
            {topFlow && <span className="text-sm text-[#6B7E73]">{flows.length} потоков</span>}
          </div>

          <div className="mt-5 space-y-3">
            {flows.length === 0 && (
              <StateCard
                description="Когда появятся сгруппированные потоки, здесь станет видно, чем именно наполнился день и как распределилось время."
                title="Потоки для этого дня пока не собраны"
                variant="empty"
              />
            )}

            {flows.map((flow) => (
              <div
                className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4"
                key={flow.name}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: flow.accent }} />
                    <span className="font-medium text-[#2B4236]">{flow.name}</span>
                  </div>
                  <span className="text-sm text-[#62756A]">{flow.time}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {flow.streams.slice(0, 3).map((stream) => (
                    <span
                      className="rounded-full border border-[#DDE8DF] bg-white px-3 py-1 text-xs text-[#5B6F64]"
                      key={stream.name}
                    >
                      {stream.name}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-sm text-[#7A8C83]">
                  {buildFlowFootnote(flow, flows)}.
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function resolveLlmFlows(
  llmSummaries: LlmSummaryRecord[],
  payload: ReturnType<typeof buildLlmSummaryPayload>,
  llmSettings: ReturnType<typeof readLlmSettings>,
  cacheSignature: string,
) {
  if (payload.items.length === 0) {
    return null
  }

  const exact = llmSummaries.find(
    (summary) =>
      summary.date_key === payload.date &&
      summary.provider === llmSettings.provider &&
      summary.model === llmSettings.model &&
      summary.payload_signature === cacheSignature,
  )
  const fallback = llmSummaries.find((summary) => summary.date_key === payload.date)
  const record = exact ?? fallback

  if (!record) {
    return null
  }

  try {
    return buildFlowsFromLlmGroups(payload, parseStoredLlmGroups(record.groups_json))
  } catch {
    return null
  }
}

function buildAvailableDateKeys(logs: ActivityLogRecord[], idleLogs: IdleLogRecord[]) {
  const dateKeys = new Set<string>()

  for (const log of logs) {
    dateKeys.add(formatDateKey(new Date(log.start_time)))
  }

  for (const log of idleLogs) {
    if (!log.ignored) {
      dateKeys.add(formatDateKey(new Date(log.start_time)))
    }
  }

  return [...dateKeys].sort((left, right) => right.localeCompare(left))
}

function buildSegments(flows: FlowSummary[]) {
  if (flows.length === 0) {
    return [{ label: "Активность", value: 100, color: ANALYTICS_COLORS[0] }]
  }

  const totalMinutes = Math.max(1, flows.reduce((sum, flow) => sum + parseDuration(flow.time), 0))

  return flows.map((flow, index) => ({
    label: flow.name,
    value: Math.max(1, Math.round((parseDuration(flow.time) / totalMinutes) * 100)),
    color: flow.accent || ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
  }))
}

function buildInsights(timeline: TimelineItem[], flows: FlowSummary[]) {
  const activityItems = timeline.filter((item) => item.kind === "activity")
  const contextSwitches = activityItems.reduce((count, item, index) => {
    if (index === 0) {
      return count
    }

    return activityItems[index - 1]?.app !== item.app ? count + 1 : count
  }, 0)
  const distractionMinutes = flows
    .filter((flow) => /развлеч|routine|рутина|idle/i.test(flow.name))
    .reduce((sum, flow) => sum + parseDuration(flow.time), 0)
  const lines = [
    flows[0]
      ? `${flows[0].name} занял больше всего времени — ${flows[0].time}.`
      : "День пока слишком пустой, чтобы делать уверенные выводы.",
    contextSwitches > 0
      ? `За день произошло ${contextSwitches} заметных переключений между приложениями.`
      : "Контекст почти не прыгал — день выглядел довольно цельным.",
    distractionMinutes > 0
      ? `На рутину и отвлекающие эпизоды ушло около ${formatMinutes(distractionMinutes)}.`
      : "Заметных провалов в рутину и отвлечения почти не видно.",
  ]

  return { contextSwitches, lines }
}

function buildHeadline(
  topFlow: FlowSummary | null,
  longestStream: { name: string; time: string } | null,
  focusPercent: string,
) {
  if (!topFlow) {
    return "Пока здесь будет собираться картина дня из первых активностей и простоев."
  }

  if (!longestStream) {
    return `${topFlow.name} уже лидирует по объему времени. Фокус дня сейчас держится на уровне ${focusPercent}.`
  }

  return `${topFlow.name} ведет день, а самый длинный стрим — ${longestStream.name}. Общий фокус сейчас ${focusPercent}.`
}

function buildRhythmValue(focusMinutes: number, idleMinutes: number) {
  if (focusMinutes === 0 && idleMinutes === 0) {
    return "Пустой день"
  }

  if (idleMinutes === 0) {
    return "Ровный темп"
  }

  return focusMinutes >= idleMinutes * 3 ? "Устойчивый ритм" : "С паузами"
}

function buildRhythmHint(activeTime: string, idleTime: string, contextSwitches: number) {
  return `Активной работы ${activeTime}, пауз ${idleTime}, переключений контекста — ${contextSwitches}.`
}

function buildFlowFootnote(flow: FlowSummary, flows: FlowSummary[]) {
  const totalMinutes = Math.max(1, flows.reduce((sum, item) => sum + parseDuration(item.time), 0))
  const flowMinutes = parseDuration(flow.time)
  const share = Math.round((flowMinutes / totalMinutes) * 100)
  const rank = flows.findIndex((item) => item.name === flow.name)

  if (rank === 0) {
    return `${flow.streams.length} стримов, главный поток дня`
  }

  if (rank === 1) {
    return `${flow.streams.length} стримов, второй по объему поток`
  }

  if (share >= 20) {
    return `${flow.streams.length} стримов, крупный блок дня`
  }

  if (share >= 8) {
    return `${flow.streams.length} стримов, поддерживающий поток`
  }

  return `${flow.streams.length} стримов, точечные эпизоды дня`
}

function parseDuration(value: string) {
  const hoursMatch = value.match(/(\d+)\s*ч/)
  const minutesMatch = value.match(/(\d+)\s*мин/)
  return Number(hoursMatch?.[1] ?? 0) * 60 + Number(minutesMatch?.[1] ?? 0)
}

function byMinutesDesc(left: { time: string }, right: { time: string }) {
  return parseDuration(right.time) - parseDuration(left.time)
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDatePill(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  })
}

function formatAnalyticsHeading(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function buildCalendarCells(month: Date) {
  const monthStart = startOfMonth(month)
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const startOffset = (monthStart.getDay() + 6) % 7
  const cells: Array<Date | null> = Array.from({ length: startOffset }, () => null)

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Focus
  label: string
  value: string
}) {
  return (
    <div className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-4">
      <div className="flex items-center gap-2 text-[#6D8176]">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-3 text-[1.28rem] font-medium leading-none text-[#284135]">{value}</p>
    </div>
  )
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
        <span className="max-w-[52%] text-right font-medium text-[#284135]">{value}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#7E8F86]">{hint}</p>
    </div>
  )
}
