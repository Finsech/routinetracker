import type { FlowSummary, TimelineItem } from "@/types"

type DayTimelineProps = {
  items: TimelineItem[]
  flows: FlowSummary[]
  totalTime: string
  selectedItemId?: string | null
  onItemSelect?: (item: TimelineItem) => void
}

const START_HOUR = 9
const END_HOUR = 22
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60
const TIMELINE_HEIGHT = 780

export function DayTimeline({
  items,
  flows,
  totalTime,
  selectedItemId,
  onItemSelect,
}: DayTimelineProps) {
  const visibleItems = items.filter(
    (item) => item.endMinutes > START_HOUR * 60 && item.startMinutes < END_HOUR * 60,
  )

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
        <div className="relative" style={{ height: `${TIMELINE_HEIGHT}px` }}>
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
            const hour = START_HOUR + index
            const top = (index / (END_HOUR - START_HOUR)) * 100

            return (
              <div
                className="absolute left-0 text-[13px] text-[#73867A]"
                key={hour}
                style={{ top: `calc(${top}% - 10px)` }}
              >
                {formatHour(hour)}
              </div>
            )
          })}
        </div>

        <div
          className="relative overflow-hidden rounded-[24px] border border-[#E1EBE3] bg-[linear-gradient(180deg,#fffdf9_0%,#fffdfa_100%)]"
          style={{ height: `${TIMELINE_HEIGHT}px` }}
        >
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
            <div
              className="absolute inset-x-0 border-t border-[#EDE8E0]"
              key={index}
              style={{ top: `${(index / (END_HOUR - START_HOUR)) * 100}%` }}
            />
          ))}

          {visibleItems.length === 0 && (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#7A8B81]">
              Как только появятся реальные интервалы, здесь соберется живой таймлайн дня.
            </div>
          )}

          <div className="relative h-full px-3 py-2">
            {visibleItems.map((item, index) => {
              const start = Math.max(item.startMinutes, START_HOUR * 60) - START_HOUR * 60
              const end = Math.min(item.endMinutes, END_HOUR * 60) - START_HOUR * 60
              const topPx = (start / DAY_MINUTES) * TIMELINE_HEIGHT
              const actualHeightPx = ((end - start) / DAY_MINUTES) * TIMELINE_HEIGHT
              const compact = item.durationMinutes <= 55
              const heightPx = Math.max(actualHeightPx, compact ? 34 : 46)
              const itemId = buildTimelineId(item, index)
              const selected = selectedItemId === itemId
              const backgroundColor = item.kind === "idle" ? "#FFF6EA" : tint(item.accent, 0.14)

              return (
                <button
                  className={`absolute left-2.5 right-2.5 overflow-hidden rounded-[18px] border px-3.5 py-2.5 text-left shadow-[0_10px_24px_rgba(110,130,118,0.08)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_28px_rgba(110,130,118,0.12)] ${
                    selected ? "border-[#8BB79E] ring-2 ring-[#CBE3D4]" : "border-white/80"
                  }`}
                  key={itemId}
                  onClick={() => onItemSelect?.(item)}
                  style={{
                    backgroundColor,
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    zIndex: selected ? 20 : index + 1,
                  }}
                  type="button"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1.5 rounded-l-[18px]"
                    style={{ backgroundColor: item.accent }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pl-2">
                      <p className="truncate text-[14px] font-medium text-[#203328]">{item.label}</p>
                      {!compact && (
                        <p className="mt-0.5 truncate text-[12px] text-[#708178]">
                          {item.app}
                          {item.url ? ` · ${formatUrl(item.url)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-medium text-[#30463A]">
                        {item.start} - {item.end}
                      </p>
                      {!compact && <p className="mt-0.5 text-[11px] text-[#7C8C83]">{item.flow}</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

function buildTimelineId(item: TimelineItem, index: number) {
  return `${item.startMinutes}-${item.endMinutes}-${item.label}-${index}`
}

function formatUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
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
