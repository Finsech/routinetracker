import { useMemo, useState } from "react"

import { formatMinutes } from "@/lib/activity-analytics"
import type { TimelineItem, WeekTimelineDay } from "@/types"

type WeekTimelineProps = {
  days: WeekTimelineDay[]
  selectedDayKey?: string | null
  onDaySelect?: (day: WeekTimelineDay) => void
}

export type WeekTimelineSegment = {
  id: string
  label: string
  accent: string
  durationMinutes: number
  episodes: number
  app: string
  flow: string
  url?: string | null
  details: TimelineItem[]
  startOffsetMinutes: number
}

export type WeekTimelineDayBar = {
  dayKey: string
  totalMinutes: number
  segments: WeekTimelineSegment[]
}

type HoveredWeekSegment = {
  dayKey: string
  segmentId: string
}

const DAY_RANGE_MINUTES = (22 - 9) * 60

export function WeekTimeline({ days, selectedDayKey, onDaySelect }: WeekTimelineProps) {
  const [hoveredSegment, setHoveredSegment] = useState<HoveredWeekSegment | null>(null)
  const dayBars = useMemo(
    () =>
      days.map((day) => ({
        day,
        bar: buildWeekTimelineDayBar(day),
      })),
    [days],
  )

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Georgia'] text-[1.9rem] leading-none text-[#24382F]">Неделя</p>
          <p className="mt-1.5 text-[13px] text-[#708178]">
            Картина недели собирается по дням: один вертикальный бар на день с разбиением по
            контекстам. Клик по дню открывает детали справа.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-3">
        {dayBars.map(({ day, bar }) => {
          const selected = selectedDayKey === day.dateKey

          return (
            <button
              className={`rounded-[22px] border px-3 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBE3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF8] ${
                selected
                  ? "border-[#CFE0D2] bg-[#F5FAF6] shadow-[0_10px_24px_rgba(110,130,118,0.09)]"
                  : "border-[#E1EBE3] bg-[linear-gradient(180deg,#fffdf9_0%,#fffdfa_100%)] hover:bg-[#FBFDFB]"
              }`}
              key={day.dateKey}
              onClick={() => onDaySelect?.(day)}
              type="button"
            >
              <p className="text-[13px] font-medium text-[#32483C]">{day.shortLabel}</p>
              <p className="mt-1 text-[11px] text-[#7A8B81]">{day.dayNumber}</p>
              <div className="mt-2 rounded-full border border-[#E3ECE5] bg-white px-3 py-1 text-[11px] text-[#62756A] shadow-sm">
                {formatMinutes(day.totalMinutes)}
              </div>

              <div className="relative mt-4 flex h-[560px] items-center justify-center">
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(220,231,222,0)_0%,rgba(220,231,222,0.7)_12%,rgba(220,231,222,0.7)_88%,rgba(220,231,222,0)_100%)]" />

                <div
                  className={`relative h-full w-[40px] rounded-[999px] border ${
                    selected ? "border-[#BFD8C7] bg-[#F3F9F3]" : "border-[#E6EEE7] bg-[#F7FAF7]"
                  }`}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[999px]">
                    {bar.segments.map((segment) => {
                      const bottom = (segment.startOffsetMinutes / DAY_RANGE_MINUTES) * 100
                      const height = (segment.durationMinutes / DAY_RANGE_MINUTES) * 100

                      return (
                        <div
                          className="absolute inset-x-0"
                          key={`${segment.id}-visual`}
                          style={{
                            bottom: `${bottom}%`,
                            height: `${height}%`,
                            backgroundColor: tint(segment.accent, 0.35),
                          }}
                        >
                          <span
                            className="absolute inset-x-0 top-0 h-[3px]"
                            style={{ backgroundColor: segment.accent }}
                          />
                        </div>
                      )
                    })}
                  </div>

                  <div className="absolute inset-0 overflow-visible">
                    {bar.segments.map((segment) => {
                      const bottom = (segment.startOffsetMinutes / DAY_RANGE_MINUTES) * 100
                      const height = Math.max((segment.durationMinutes / DAY_RANGE_MINUTES) * 100, 1.2)
                      const hovered =
                        hoveredSegment?.dayKey === day.dateKey &&
                        hoveredSegment.segmentId === segment.id
                      const tooltipPosition = resolveWeekTooltipPosition(dayBars, day.dateKey)

                      return (
                        <div
                          className="absolute inset-x-0"
                          key={`${segment.id}-hitbox`}
                          onMouseEnter={() =>
                            setHoveredSegment({ dayKey: day.dateKey, segmentId: segment.id })
                          }
                          onMouseLeave={() =>
                            setHoveredSegment((current) =>
                              current?.segmentId === segment.id ? null : current,
                            )
                          }
                          style={{
                            bottom: `${bottom}%`,
                            height: `${height}%`,
                          }}
                        >
                          {hovered && (
                            <div
                              className={`absolute top-1/2 z-50 w-[320px] -translate-y-1/2 rounded-[20px] border border-[#DCE7DE] bg-white p-4 text-left shadow-[0_18px_50px_rgba(73,97,84,0.18)] ${
                                tooltipPosition === "start" ? "left-[calc(100%+12px)]" : "right-[calc(100%+12px)]"
                              }`}
                              onMouseEnter={() =>
                                setHoveredSegment({ dayKey: day.dateKey, segmentId: segment.id })
                              }
                              onMouseLeave={() => setHoveredSegment(null)}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#24382F]">
                                  {segment.label}
                                </p>
                                <p className="mt-1 text-xs text-[#75877E]">
                                  {segment.episodes} эпизодов • {formatMinutes(segment.durationMinutes)}
                                </p>
                              </div>

                              <div className="mt-3 h-[300px] overflow-y-auto rounded-[14px] border border-[#E8EFE9] bg-[#FBFDFB] p-2">
                                <div className="space-y-2">
                                  {segment.details.map((detail, index) => (
                                    <div
                                      className="rounded-[12px] border border-[#E7EFE9] bg-white px-3 py-2"
                                      key={`${segment.id}-${detail.startMinutes}-${detail.endMinutes}-${index}`}
                                    >
                                      <p className="truncate text-xs font-medium text-[#274034]">
                                        {detail.label}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[#7A8C83]">
                                        {detail.app}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[#87978F]">
                                        {detail.start} - {detail.end}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function buildWeekTimelineDayBar(day: WeekTimelineDay): WeekTimelineDayBar {
  const segmentsMap = new Map<string, Omit<WeekTimelineSegment, "startOffsetMinutes">>()

  for (const item of day.items) {
    const context = resolveContext(item)
    const id = `${day.dateKey}-${context.key}`
    const existing = segmentsMap.get(id)

    if (existing) {
      existing.durationMinutes += item.durationMinutes
      existing.episodes += 1
      existing.details.push(item)
      continue
    }

    segmentsMap.set(id, {
      id,
      label: context.label,
      accent: item.accent,
      durationMinutes: item.durationMinutes,
      episodes: 1,
      app: item.app,
      flow: item.flow,
      url: item.url,
      details: [item],
    })
  }

  let offset = 0
  const segments = [...segmentsMap.values()].map((segment) => {
    const nextSegment: WeekTimelineSegment = {
      ...segment,
      startOffsetMinutes: offset,
    }
    offset += segment.durationMinutes
    return nextSegment
  })

  return {
    dayKey: day.dateKey,
    totalMinutes: day.totalMinutes,
    segments,
  }
}

function resolveContext(item: TimelineItem) {
  if (item.kind === "idle") {
    return {
      key: "idle",
      label: item.label,
    }
  }

  const domain = item.url ? formatUrl(item.url) : null

  if (domain) {
    return {
      key: `site:${domain}`,
      label: domain,
    }
  }

  return {
    key: `app:${item.app.toLowerCase()}`,
    label: item.app,
  }
}

function resolveWeekTooltipPosition(
  dayBars: { day: WeekTimelineDay; bar: WeekTimelineDayBar }[],
  dayKey: string,
) {
  const index = dayBars.findIndex((item) => item.day.dateKey === dayKey)
  return index <= Math.floor(dayBars.length / 2) ? "start" : "end"
}

function formatUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "")
  } catch {
    return value
  }
}

function tint(hex: string, alpha: number) {
  const normalized = hex.replace("#", "")
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
