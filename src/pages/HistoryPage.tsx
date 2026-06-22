import { Heatmap } from "@/components/dashboard/Heatmap"
import { WeekTimeline } from "@/components/dashboard/WeekTimeline"
import { week } from "@/data/mock"

export function HistoryPage() {
  const totalHours = week.reduce((sum, item) => sum + item.hours, 0)

  return (
    <div className="space-y-4">
      <Heatmap totalHours={totalHours} />
      <WeekTimeline items={week} />
    </div>
  )
}

