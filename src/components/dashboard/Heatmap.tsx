import type { HeatmapCell, HeatmapMonthLabel } from "@/types"
import { Fragment } from "react"

type HeatmapProps = {
  cells: HeatmapCell[]
  months: HeatmapMonthLabel[]
  totalHours: number
}

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

export function Heatmap({ cells, months, totalHours }: HeatmapProps) {
  const weeks = Math.max(...cells.map((cell) => cell.weekIndex), 0) + 1
  const maxMinutes = Math.max(...cells.map((cell) => cell.totalMinutes), 0)
  const cellsByCoordinate = new Map(
    cells.map((cell) => [`${cell.weekIndex}:${cell.weekday}`, cell] as const),
  )

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#24382F]">Годовая сетка активности</h2>
          <p className="text-xs text-[#71837A]">GitHub-like тепловая карта по реальным часам работы.</p>
        </div>
        <div className="rounded-full border border-[#DCE8DD] bg-[#F8FBF8] px-4 py-2 text-sm font-medium text-[#30463A]">
          {totalHours.toFixed(1)} ч в этом году
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[860px]">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `40px repeat(${weeks}, 12px)`,
            }}
          >
            <div />
            {Array.from({ length: weeks }, (_, weekIndex) => {
              const month = months.find((item) => item.weekIndex === weekIndex)
              return (
                <div
                  className="text-[11px] text-[#73867A]"
                  key={`month-${weekIndex}`}
                  style={{ gridColumn: weekIndex + 2 }}
                >
                  {month?.label ?? ""}
                </div>
              )
            })}

            {DAY_LABELS.map((label, weekday) => (
              <Fragment key={label}>
                <div className="pr-2 text-[11px] text-[#73867A]">{label}</div>
                {Array.from({ length: weeks }, (_, weekIndex) => {
                  const cell = cellsByCoordinate.get(`${weekIndex}:${weekday}`)

                  return (
                    <div
                      className="size-3 rounded-[3px] border border-white/80"
                      key={`${label}-${weekIndex}`}
                      style={{
                        backgroundColor: colorForCell(cell?.totalMinutes ?? 0, maxMinutes),
                        boxShadow:
                          cell && cell.totalMinutes > 0
                            ? "inset 0 0 0 1px rgba(36,56,47,0.08)"
                            : "none",
                      }}
                      title={
                        cell
                          ? `${cell.dateKey}: ${(cell.totalMinutes / 60).toFixed(1)} ч`
                          : `${label}: нет данных`
                      }
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 text-[11px] text-[#73867A]">
        <span>меньше</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <span
              className="size-3 rounded-[3px]"
              key={level}
              style={{ backgroundColor: colorForLevel(level) }}
            />
          ))}
        </div>
        <span>больше</span>
      </div>
    </section>
  )
}

function colorForCell(totalMinutes: number, maxMinutes: number) {
  if (totalMinutes <= 0 || maxMinutes <= 0) {
    return colorForLevel(0)
  }

  const ratio = totalMinutes / maxMinutes

  if (ratio >= 0.85) return colorForLevel(5)
  if (ratio >= 0.65) return colorForLevel(4)
  if (ratio >= 0.4) return colorForLevel(3)
  if (ratio >= 0.18) return colorForLevel(2)
  return colorForLevel(1)
}

function colorForLevel(level: number) {
  return (
    [
      "#EEF2EE",
      "#D7E8DB",
      "#A6D5B1",
      "#72C789",
      "#3FB95E",
      "#1FAA44",
    ][level] ?? "#EEF2EE"
  )
}
