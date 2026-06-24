import { useMemo, useState } from "react"

import { StateCard } from "@/components/app/StateCard"
import type { FlowSummary, TimelineItem } from "@/types"

type DayTimelineProps = {
  items: TimelineItem[]
  flows: FlowSummary[]
  totalTime: string
  selectedHour?: number | null
  onHourSelect?: (row: HourTimelineRow) => void
}

export type DayTimelineSegment = {
  id: string
  hour: number
  label: string
  accent: string
  start: string
  end: string
  durationMinutes: number
  episodes: number
  app: string
  flow: string
  url?: string | null
  details: TimelineItem[]
}

export type HourTimelineRow = {
  hour: number
  label: string
  segments: DayTimelineSegment[]
  coveredMinutes: number
}

const START_HOUR = 9
const END_HOUR = 22

export function DayTimeline({
  items,
  flows,
  totalTime,
  selectedHour,
  onHourSelect,
}: DayTimelineProps) {
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)
  const visibleItems = items.filter(
    (item) => item.endMinutes > START_HOUR * 60 && item.startMinutes < END_HOUR * 60,
  )
  const rows = useMemo(() => buildHourTimelineRows(visibleItems), [visibleItems])

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(91,121,108,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-['Georgia'] text-[1.9rem] leading-none text-[#24382F]">Сегодня</p>
          <p className="mt-1.5 text-[13px] text-[#708178]">
            Таймлайн дня и нейросводка по уже собранному треку.
          </p>
        </div>
        <div className="rounded-full border border-[#D9E5DC] bg-[#F8FBF8] px-3.5 py-1.5 text-[13px] font-medium text-[#2B493A]">
          {totalTime}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {flows.map((flow) => (
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[#DDE9E0] bg-white px-3 py-1 text-[13px] text-[#31483A]"
            key={flow.name}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: flow.accent }} />
            <span>{flow.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[76px_minmax(0,1fr)] gap-3">
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div className="flex h-[52px] items-start pt-1 text-[13px] text-[#73867A]" key={row.hour}>
              {formatHour(row.hour)}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#E1EBE3] bg-[linear-gradient(180deg,#fffdf9_0%,#fffdfa_100%)]">
          {visibleItems.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center px-8 py-10">
              <div className="w-full max-w-md">
                <StateCard
                  description="Как только появятся реальные интервалы, здесь соберется живой таймлайн дня с деталями по окнам, сайтам и потокам."
                  title="Таймлайн дня пока пуст"
                  variant="empty"
                />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#EDE8E0]">
              {rows.map((row) => (
                <button
                  className={`grid min-h-[52px] grid-cols-[minmax(0,1fr)] items-center px-3 py-2 text-left transition ${
                    selectedHour === row.hour ? "bg-[#F7FBF7]" : "hover:bg-[#FBFDFB]"
                  }`}
                  key={row.hour}
                  onClick={() => onHourSelect?.(row)}
                  type="button"
                >
                  <div className="relative h-[32px] overflow-visible">
                    <div
                      className={`flex h-full items-stretch overflow-hidden rounded-full border ${
                        selectedHour === row.hour
                          ? "border-[#BFD8C7] bg-[#F3F9F3]"
                          : "border-[#E6EEE7] bg-[#F7FAF7]"
                      }`}
                    >
                      {row.segments.map((segment) => {
                        const widthPercent = (segment.durationMinutes / 60) * 100
                        const hovered = hoveredSegmentId === segment.id

                        return (
                          <div
                            className="group relative h-full min-w-0 border-r border-white/60 last:border-r-0"
                            key={segment.id}
                            onMouseEnter={() => setHoveredSegmentId(segment.id)}
                            onMouseLeave={() => setHoveredSegmentId((current) => (current === segment.id ? null : current))}
                            style={{
                              backgroundColor: tint(segment.accent, 0.28),
                              width: `${widthPercent}%`,
                            }}
                          >
                            <span
                              className="absolute inset-y-0 left-0 w-1"
                              style={{ backgroundColor: segment.accent }}
                            />
                            <div className="flex h-full items-center justify-between gap-2 px-3 text-[12px] text-[#264034]">
                              {widthPercent >= 12 ? (
                                <>
                                  <span className="truncate font-medium">{segment.label}</span>
                                  {widthPercent >= 20 && (
                                    <span className="shrink-0 text-[#557064]">
                                      {formatCompactMinutes(segment.durationMinutes)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="sr-only">
                                  {segment.label} {formatCompactMinutes(segment.durationMinutes)}
                                </span>
                              )}
                            </div>

                            {hovered && (
                              <div className="absolute left-1/2 top-[calc(100%+8px)] z-20 w-[320px] -translate-x-1/2 rounded-[20px] border border-[#DCE7DE] bg-white p-4 text-left shadow-[0_18px_50px_rgba(73,97,84,0.18)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-[#24382F]">{segment.label}</p>
                                    <p className="mt-1 text-xs text-[#75877E]">
                                      {segment.episodes} эпизодов • {formatCompactMinutes(segment.durationMinutes)}
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

                      {row.coveredMinutes < 60 && (
                        <div
                          className="h-full bg-transparent"
                          style={{ width: `${((60 - row.coveredMinutes) / 60) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function buildHourTimelineRows(items: TimelineItem[]): HourTimelineRow[] {
  return Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
    const hour = START_HOUR + index
    const bucketStart = hour * 60
    const bucketEnd = (hour + 1) * 60
    const segmentsMap = new Map<string, DayTimelineSegment>()

    for (const item of items) {
      const overlapStart = Math.max(item.startMinutes, bucketStart)
      const overlapEnd = Math.min(item.endMinutes, bucketEnd)
      const overlapMinutes = overlapEnd - overlapStart

      if (overlapMinutes <= 0) {
        continue
      }

      const context = resolveContext(item)
      const id = `${hour}-${context.key}`
      const segment = segmentsMap.get(id)

      if (segment) {
        segment.durationMinutes += overlapMinutes
        segment.episodes += 1
        segment.details.push(item)
        segment.end = laterClock(segment.end, item.end)
        continue
      }

      segmentsMap.set(id, {
        id,
        hour,
        label: context.label,
        accent: item.accent,
        start: item.start,
        end: item.end,
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
      hour,
      label: formatHour(hour),
      segments,
      coveredMinutes,
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

function laterClock(left: string, right: string) {
  return toClockValue(left) >= toClockValue(right) ? left : right
}

function toClockValue(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

function formatCompactMinutes(totalMinutes: number) {
  const rounded = Math.max(1, Math.round(totalMinutes))
  if (rounded < 60) {
    return `${rounded} мин`
  }

  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60

  if (minutes === 0) {
    return `${hours} ч`
  }

  return `${hours}ч ${minutes}м`
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
