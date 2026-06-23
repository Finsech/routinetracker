import { formatMinutes } from "@/lib/activity-analytics"
import type { WeekTimelineDay } from "@/types"

type WeekTimelineProps = {
  days: WeekTimelineDay[]
}

const START_HOUR = 9
const END_HOUR = 22
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60
const TIMELINE_HEIGHT = 820

export function WeekTimeline({ days }: WeekTimelineProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Georgia'] text-[2rem] leading-none text-[#24382F]">Неделя</p>
          <p className="mt-2 text-sm text-[#708178]">
            Реальная недельная сетка по интервалам активности, без повторения дневной суммы в каждой ячейке.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-3">
        <div />
        {days.map((day) => (
          <div className="text-center" key={day.dateKey}>
            <p className="text-sm font-medium text-[#32483C]">{day.shortLabel}</p>
            <p className="mt-1 text-xs text-[#7A8B81]">{day.dayNumber}</p>
            <div className="mt-2 rounded-full border border-[#E3ECE5] bg-white px-3 py-1 text-[11px] text-[#62756A] shadow-sm">
              {formatMinutes(day.totalMinutes)}
            </div>
          </div>
        ))}

        <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
            const hour = START_HOUR + index
            const top = (index / (END_HOUR - START_HOUR)) * 100

            return (
              <div
                className="absolute left-0 text-sm text-[#73867A]"
                key={hour}
                style={{ top: `calc(${top}% - 10px)` }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            )
          })}
        </div>

        {days.map((day) => (
          <div
            className="relative overflow-hidden rounded-[22px] border border-[#E1EBE3] bg-[linear-gradient(180deg,#fffdf9_0%,#fffdfa_100%)]"
            key={day.dateKey}
            style={{ height: `${TIMELINE_HEIGHT}px` }}
          >
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
              <div
                className="absolute inset-x-0 border-t border-[#EDE8E0]"
                key={index}
                style={{ top: `${(index / (END_HOUR - START_HOUR)) * 100}%` }}
              />
            ))}

            <div className="relative h-full px-2 py-2">
              {day.items.map((item, index) => {
                const start = Math.max(item.startMinutes, START_HOUR * 60) - START_HOUR * 60
                const end = Math.min(item.endMinutes, END_HOUR * 60) - START_HOUR * 60
                const topPx = (start / DAY_MINUTES) * TIMELINE_HEIGHT
                const actualHeightPx = ((end - start) / DAY_MINUTES) * TIMELINE_HEIGHT
                const compact = item.durationMinutes <= 45
                const heightPx = Math.max(actualHeightPx, compact ? 24 : 38)
                const backgroundColor = item.kind === "idle" ? "#FFF6EA" : tint(item.accent, 0.16)

                return (
                  <div
                    className="absolute left-2 right-2 overflow-hidden rounded-[16px] border border-white/80 px-2.5 py-2 shadow-[0_8px_18px_rgba(110,130,118,0.08)]"
                    key={`${day.dateKey}-${item.startMinutes}-${index}`}
                    style={{
                      backgroundColor,
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      zIndex: index + 1,
                    }}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1 rounded-l-[16px]"
                      style={{ backgroundColor: item.accent }}
                    />
                    <div className="pl-2">
                      <p className="truncate text-[11px] font-medium text-[#203328]">{item.label}</p>
                      {!compact && (
                        <p className="mt-1 truncate text-[10px] text-[#73867A]">
                          {item.start} - {item.end}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
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
