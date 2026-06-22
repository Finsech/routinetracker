import { DayTimeline } from "@/components/dashboard/DayTimeline"
import { FlowCard } from "@/components/dashboard/FlowCard"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { flows, timeline } from "@/data/mock"

export function TodayPage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <DayTimeline items={timeline} />

      <section className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Фокус" value="72%" />
          <MetricCard label="Активно" value="6:30" />
          <MetricCard label="Простой" value="0:42" />
        </div>

        {flows.map((flow) => (
          <FlowCard flow={flow} key={flow.name} />
        ))}
      </section>
    </div>
  )
}

