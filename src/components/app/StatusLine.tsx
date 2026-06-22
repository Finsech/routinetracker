import type { LucideIcon } from "lucide-react"

type StatusLineProps = {
  icon: LucideIcon
  label: string
  value: string
}

export function StatusLine({ icon: Icon, label, value }: StatusLineProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-zinc-600">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs text-zinc-500" title={value}>
        {value}
      </span>
    </div>
  )
}
