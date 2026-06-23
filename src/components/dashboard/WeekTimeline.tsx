import type { WeekActivity } from "@/types"

type WeekTimelineProps = {
  items: WeekActivity[]
}

const HOURS = [10, 12, 14, 16, 18, 20]

export function WeekTimeline({ items }: WeekTimelineProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Georgia'] text-[2rem] leading-none text-[#24382F]">Неделя</p>
          <p className="mt-2 text-sm text-[#708178]">
            Недельная сетка в духе Dayflow: дни колонками, ритм работы — по вертикали.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-3">
        <div />
        {items.map((item) => (
          <div className="text-center text-sm font-medium text-[#32483C]" key={item.day}>
            {item.day}
          </div>
        ))}

        {HOURS.map((hour) => (
          <WeekRow hour={hour} items={items} key={hour} />
        ))}
      </div>
    </section>
  )
}

function WeekRow({ hour, items }: { hour: number; items: WeekActivity[] }) {
  return (
    <>
      <div className="pt-3 text-sm text-[#73867A]">{formatHour(hour)}</div>
      {items.map((item) => {
        const fill = Math.max(8, Math.min(100, Math.round((item.hours / 8) * 100)))

        return (
          <div
            className="rounded-[20px] border border-[#E1EBE3] bg-[#FFFCF7] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
            key={`${item.day}-${hour}`}
          >
            <div className="h-[92px] rounded-[14px] bg-[#F4F1E8] p-1">
              <div
                className="flex h-full items-end rounded-[12px] bg-[linear-gradient(180deg,rgba(182,228,197,0.48)_0%,rgba(121,182,145,0.82)_100%)] px-2 py-2"
                style={{
                  clipPath: `inset(${100 - fill}% 0 0 0 round 12px)`,
                }}
              >
                <span className="text-xs font-medium text-[#244133]">{item.hours.toFixed(1)} ч</span>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}
