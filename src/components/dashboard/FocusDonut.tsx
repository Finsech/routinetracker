type DonutSegment = {
  label: string
  value: number
  color: string
}

type FocusDonutProps = {
  centerLabel: string
  centerValue: string
  segments: DonutSegment[]
}

export function FocusDonut({ centerLabel, centerValue, segments }: FocusDonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const gradient = buildGradient(segments, total)

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex size-[220px] items-center justify-center rounded-full"
        style={{ background: gradient }}
      >
        <div className="flex size-[126px] flex-col items-center justify-center rounded-full bg-[#FFFDF9] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8C9B92]">{centerLabel}</span>
          <span className="mt-2 font-['Georgia'] text-[1.55rem] leading-tight text-[#244133]">
            {centerValue}
          </span>
        </div>
      </div>

      <div className="mt-5 grid w-full gap-2">
        {segments.map((segment) => (
          <div className="flex items-center justify-between gap-3 text-sm" key={segment.label}>
            <div className="flex items-center gap-2 text-[#53665C]">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span>{segment.label}</span>
            </div>
            <span className="font-medium text-[#2A4035]">{segment.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildGradient(segments: DonutSegment[], total: number) {
  if (total <= 0) {
    return "conic-gradient(#E8EEE9 0 100%)"
  }

  let current = 0
  const stops = segments.map((segment) => {
    const start = current
    const sweep = (segment.value / total) * 360
    current += sweep
    return `${segment.color} ${start}deg ${current}deg`
  })

  return `conic-gradient(${stops.join(", ")})`
}
