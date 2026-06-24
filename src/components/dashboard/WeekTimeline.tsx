import { useMemo, useState } from "react"

import { formatMinutes } from "@/lib/activity-analytics"
import type { TimelineItem, WeekTimelineDay } from "@/types"

type WeekTimelineProps = {
  days: WeekTimelineDay[]
  selectedDayKey?: string | null
  selectedHourCellId?: string | null
  onDaySelect?: (day: WeekTimelineDay) => void
  onHourCellSelect?: (day: WeekTimelineDay, cell: WeekTimelineHourCell) => void
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
}

export type WeekTimelineHourCell = {
  id: string
  dayKey: string
  hour: number
  label: string
  coveredMinutes: number
  segments: WeekTimelineSegment[]
}

const START_HOUR = 9
const END_HOUR = 22

export function WeekTimeline({
  days,
  selectedDayKey,
  selectedHourCellId,
  onDaySelect,
  onHourCellSelect,
}: WeekTimelineProps) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)
  const dayCells = useMemo(
    () =>
      days.map((day) => ({
        day,
        cells: buildWeekTimelineHourCells(day),
      })),
    [days],
  )

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Georgia'] text-[1.9rem] leading-none text-[#24382F]">Неделя</p>
          <p className="mt-1.5 text-[13px] text-[#708178]">
            Сетка недели по реальным интервалам активности. Клик по дню или часу открывает детали справа.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[68px_repeat(7,minmax(0,1fr))] gap-2.5">
        <div />
        {days.map((day) => (
          <button
            className={`rounded-[16px] px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBE3D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF8] ${
              selectedDayKey === day.dateKey
                ? "bg-[#F3F8F4] shadow-[0_8px_18px_rgba(110,130,118,0.08)]"
                : "hover:bg-[#F8FBF8]"
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
          </button>
        ))}

        <div className="space-y-2">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
            const hour = START_HOUR + index

            return (
              <div className="flex h-[52px] items-start pt-1 text-[13px] text-[#73867A]" key={hour}>
                {String(hour).padStart(2, "0")}:00
              </div>
            )
          })}
        </div>

        {dayCells.map(({ day, cells }) => (
          <div
            className={`overflow-hidden rounded-[20px] border bg-[linear-gradient(180deg,#fffdf9_0%,#fffdfa_100%)] ${
              selectedDayKey === day.dateKey ? "border-[#CFE0D2]" : "border-[#E1EBE3]"
            }`}
            key={day.dateKey}
          >
            <div className="divide-y divide-[#EDE8E0]">
              {cells.map((cell) => (
                <button
                  className={`grid min-h-[52px] grid-cols-[minmax(0,1fr)] items-center px-2 py-2 text-left transition ${
                    selectedHourCellId === cell.id ? "bg-[#F7FBF7]" : "hover:bg-[#FBFDFB]"
                  }`}
                  key={cell.id}
                  onClick={() => onHourCellSelect?.(day, cell)}
                  type="button"
                >
                  <div
                    className={`relative flex h-[36px] items-center justify-center overflow-visible rounded-[16px] border ${
                      selectedHourCellId === cell.id
                        ? "border-[#BFD8C7] bg-[#F3F9F3]"
                        : "border-[#E6EEE7] bg-[#F7FAF7]"
                    }`}
                  >
                    <div className="relative h-[28px] w-[14px] overflow-visible rounded-full bg-[#EEF4EF] ring-1 ring-[#E0EAE2]">
                      <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse overflow-visible rounded-full">
                        {cell.segments.map((segment) => {
                          const heightPercent = (segment.durationMinutes / 60) * 100
                          const hovered = hoveredSegmentId === segment.id

                          return (
                            <div
                              className="group relative min-h-[4px] w-full first:rounded-t-full last:rounded-b-full"
                              key={segment.id}
                              onMouseEnter={() => setHoveredSegmentId(segment.id)}
                              onMouseLeave={() => setHoveredSegmentId((current) => (current === segment.id ? null : current))}
                              style={{
                                backgroundColor: segment.accent,
                                height: `${heightPercent}%`,
                              }}
                            >
                              {hovered && (
                                <div className="absolute left-[calc(100%+10px)] top-1/2 z-20 w-[320px] -translate-y-1/2 rounded-[20px] border border-[#DCE7DE] bg-white p-4 text-left shadow-[0_18px_50px_rgba(73,97,84,0.18)]">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-[#24382F]">{segment.label}</p>
                                      <p className="mt-1 text-xs text-[#75877E]">
                                        {segment.episodes} эпизодов • {formatMinutes(segment.durationMinutes)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-3 h-[300px] overflow-y-auto rounded-[14px] border border-[#E8EFE9] bg-[#FBFDFB] p-2">
                                    <div className="space-y-2">
                                      {segment.details.map((detail, index) => (
                                        <div
                                          className="rounded-[12px] border border-[#E7EFE9] bg-white px-3 py-2"
                                          key={`${segment.id}-${detail.startMinutes}-${detail.endMinutes}-${index}`}
                                        >
                                          <p className="truncate text-xs font-medium text-[#274034]">{detail.label}</p>
                                          <p className="mt-1 text-[11px] text-[#7A8C83]">{detail.app}</p>
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function buildWeekTimelineHourCells(day: WeekTimelineDay): WeekTimelineHourCell[] {
  return Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
    const hour = START_HOUR + index
    const bucketStart = hour * 60
    const bucketEnd = (hour + 1) * 60
    const segmentsMap = new Map<string, WeekTimelineSegment>()

    for (const item of day.items) {
      const overlapStart = Math.max(item.startMinutes, bucketStart)
      const overlapEnd = Math.min(item.endMinutes, bucketEnd)
      const overlapMinutes = overlapEnd - overlapStart

      if (overlapMinutes <= 0) {
        continue
      }

      const context = resolveContext(item)
      const id = `${day.dateKey}-${hour}-${context.key}`
      const existing = segmentsMap.get(id)

      if (existing) {
        existing.durationMinutes += overlapMinutes
        existing.episodes += 1
        existing.details.push(item)
        continue
      }

      segmentsMap.set(id, {
        id,
        label: context.label,
        accent: item.accent,
        durationMinutes: overlapMinutes,
        episodes: 1,
        app: item.app,
        flow: item.flow,
        url: item.url,
        details: [item],
      })
    }

    const segments = [...segmentsMap.values()]
    const coveredMinutes = segments.reduce((sum, segment) => sum + segment.durationMinutes, 0)

    return {
      id: `${day.dateKey}-${hour}`,
      dayKey: day.dateKey,
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      coveredMinutes,
      segments,
    }
  })
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

function formatUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "")
  } catch {
    return value
  }
}
