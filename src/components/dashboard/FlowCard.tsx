import type { FlowStream, FlowSummary } from "@/types"

type FlowCardProps = {
  flow: FlowSummary
  onStreamSelect?: (flow: FlowSummary, stream: FlowStream) => void
}

export function FlowCard({ flow, onStreamSelect }: FlowCardProps) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: flow.accent }} />
          <h2 className="text-sm font-semibold">{flow.name}</h2>
        </div>
        <span className="text-sm font-medium">{flow.time}</span>
      </div>
      <div className="divide-y divide-zinc-100">
        {flow.streams.map((stream) => (
          <button
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
            key={stream.name}
            onClick={() => onStreamSelect?.(flow, stream)}
            type="button"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{stream.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{stream.activities} активностей</p>
            </div>
            <span className="shrink-0 text-sm text-zinc-600">{stream.time}</span>
          </button>
        ))}
      </div>
    </article>
  )
}
