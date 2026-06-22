import { Clock3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TimelineItem } from "@/types"

type DayTimelineProps = {
  items: TimelineItem[]
}

export function DayTimeline({ items }: DayTimelineProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Таймлайн дня</h2>
          <p className="text-xs text-zinc-500">Мок-данные до подключения трекинга</p>
        </div>
        <Button variant="outline">
          <Clock3 className="size-4" />6 ч 30 мин
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {items.map((item) => (
          <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3" key={`${item.start}-${item.label}`}>
            <div className="pt-2 text-xs text-zinc-500">{item.start}</div>
            <div className={`${item.size} rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.app}</p>
                </div>
                <span className="rounded-sm bg-white px-2 py-1 text-xs text-zinc-600">
                  {item.flow}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

