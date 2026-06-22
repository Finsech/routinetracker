import { BarChart3 } from "lucide-react"

import { Button } from "@/components/ui/button"

type HeatmapProps = {
  totalHours: number
}

const heatmapCells = Array.from({ length: 98 }, (_, index) => (index * 7) % 5)

export function Heatmap({ totalHours }: HeatmapProps) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Годовая сетка активности</h2>
          <p className="text-xs text-zinc-500">GitHub-style heatmap на мок-данных</p>
        </div>
        <Button variant="outline">
          <BarChart3 className="size-4" />
          {totalHours.toFixed(1)} ч за неделю
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 overflow-hidden">
        {heatmapCells.map((level, index) => (
          <div
            aria-label={`День ${index + 1}`}
            className="aspect-square rounded-sm"
            key={index}
            style={{ backgroundColor: heatColor(level) }}
          />
        ))}
      </div>
    </section>
  )
}

function heatColor(level: number) {
  return ["#EEF2F0", "#DCFCE7", "#86EFAC", "#22C55E", "#15803D"][level] ?? "#EEF2F0"
}

