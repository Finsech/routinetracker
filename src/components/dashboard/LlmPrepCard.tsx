import { useMemo, useState } from "react"
import { Clipboard, ClipboardCheck, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  stringifyLlmPayload,
  type LlmProviderSettings,
  type LlmSummaryPayload,
} from "@/lib/llm-summary"

type LlmPrepCardProps = {
  disabled?: boolean
  error: string | null
  loading: boolean
  onGenerate: () => void
  payload: LlmSummaryPayload
  settings: LlmProviderSettings
}

export function LlmPrepCard({
  disabled = false,
  error,
  loading,
  onGenerate,
  payload,
  settings,
}: LlmPrepCardProps) {
  const [copied, setCopied] = useState(false)
  const json = useMemo(() => stringifyLlmPayload(payload), [payload])
  const totalItems = payload.activity_count + payload.idle_count

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">LLM-группировка</h2>
          <p className="text-xs text-zinc-500">
            Ollama · {settings.model} · {settings.ollamaUrl}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={copyPayload} size="sm" type="button" variant="outline">
            {copied ? <ClipboardCheck className="size-4" /> : <Clipboard className="size-4" />}
            {copied ? "Скопировано" : "JSON"}
          </Button>
          <Button disabled={disabled || loading || totalItems === 0} onClick={onGenerate} size="sm" type="button">
            <Sparkles className="size-4" />
            {loading ? "Группирую" : "Сгруппировать"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <SummaryStat label="Записей" value={String(totalItems)} />
        <SummaryStat label="Активно" value={`${payload.total_active_minutes} мин`} />
        <SummaryStat label="Простой" value={`${payload.total_idle_minutes} мин`} />
      </div>

      <div className="border-t border-zinc-100 px-4 py-3">
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Локальная модель получает только JSON текущего дня и возвращает стримы и потоки.
          </p>
        )}
      </div>
    </section>
  )
}

type SummaryStatProps = {
  label: string
  value: string
}

function SummaryStat({ label, value }: SummaryStatProps) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}
