import type { WeekActivity } from "@/types"

type WeekTimelineProps = {
  items: WeekActivity[]
}

export function WeekTimeline({ items }: WeekTimelineProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Таймлайн недели</h2>
      <div className="mt-5 grid h-48 grid-cols-7 items-end gap-3">
        {items.map((item) => (
          <div className="flex h-full flex-col justify-end gap-2" key={item.day}>
            <div
              className="rounded-t-md bg-[#22C55E]"
              style={{ height: `${Math.max(item.hours * 18, 10)}px` }}
            />
            <div className="text-center text-xs text-zinc-500">{item.day}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

