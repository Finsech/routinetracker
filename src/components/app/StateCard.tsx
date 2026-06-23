import { AlertCircle, Inbox, LoaderCircle, type LucideIcon } from "lucide-react"

type StateCardVariant = "empty" | "error" | "loading" | "info"

type StateCardProps = {
  className?: string
  description?: string
  title: string
  variant?: StateCardVariant
}

const variantMap: Record<
  StateCardVariant,
  {
    icon: LucideIcon
    iconClassName: string
    panelClassName: string
    titleClassName: string
    descriptionClassName: string
  }
> = {
  empty: {
    icon: Inbox,
    iconClassName: "text-[#7E9387]",
    panelClassName: "border border-dashed border-[#D9E5DC] bg-[#FBFDFB]",
    titleClassName: "text-[#31483A]",
    descriptionClassName: "text-[#75877D]",
  },
  error: {
    icon: AlertCircle,
    iconClassName: "text-[#B75A5A]",
    panelClassName: "border border-[#F0D1D1] bg-[#FFF4F4]",
    titleClassName: "text-[#8E4343]",
    descriptionClassName: "text-[#A35A5A]",
  },
  loading: {
    icon: LoaderCircle,
    iconClassName: "animate-spin text-[#6E8D7B]",
    panelClassName: "border border-[#E2EBE4] bg-white/82",
    titleClassName: "text-[#31483A]",
    descriptionClassName: "text-[#73867A]",
  },
  info: {
    icon: Inbox,
    iconClassName: "text-[#6E8D7B]",
    panelClassName: "border border-[#E2EBE4] bg-[#FBFDFB]",
    titleClassName: "text-[#31483A]",
    descriptionClassName: "text-[#75877D]",
  },
}

export function StateCard({
  className,
  description,
  title,
  variant = "info",
}: StateCardProps) {
  const styles = variantMap[variant]
  const Icon = styles.icon

  return (
    <div
      className={`rounded-[22px] px-4 py-4 shadow-[0_14px_40px_rgba(91,121,108,0.06)] ${styles.panelClassName} ${className ?? ""}`.trim()}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className={`size-4 ${styles.iconClassName}`} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${styles.titleClassName}`}>{title}</p>
          {description ? (
            <p className={`mt-1.5 text-sm leading-6 ${styles.descriptionClassName}`}>{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
