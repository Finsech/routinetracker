import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Sparkles, X } from "lucide-react"

import { DayTimeline } from "@/components/dashboard/DayTimeline"
import { FocusDonut } from "@/components/dashboard/FocusDonut"
import { Button } from "@/components/ui/button"
import { buildTodaySummary, formatMinutes } from "@/lib/activity-analytics"
import {
  getActivityLogs,
  getIdleLogs,
  getLlmSummary,
  getSettings,
  saveLlmSummary,
  updateIdleLog,
  type ActivityLogRecord,
  type IdleLogRecord,
} from "@/lib/focusflow-api"
import {
  DEFAULT_LLM_SETTINGS,
  buildFlowsFromLlmGroups,
  buildLlmCacheSignature,
  buildLlmSummaryPayload,
  parseStoredLlmGroups,
  readLlmSettings,
  requestOllamaSummary,
  serializeLlmGroups,
  type LlmProviderSettings,
} from "@/lib/llm-summary"
import type { FlowStream, FlowSummary, TimelineItem } from "@/types"

type SelectedStream = {
  flow: FlowSummary
  stream: FlowStream
}

export function TodayPage() {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [idleLogs, setIdleLogs] = useState<IdleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [idleNote, setIdleNote] = useState("")
  const [postponedIdleIds, setPostponedIdleIds] = useState<number[]>([])
  const [llmSettings, setLlmSettings] = useState<LlmProviderSettings>(DEFAULT_LLM_SETTINGS)
  const [llmFlows, setLlmFlows] = useState<FlowSummary[] | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmCachedAt, setLlmCachedAt] = useState<string | null>(null)
  const [selectedStream, setSelectedStream] = useState<SelectedStream | null>(null)
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<TimelineItem | null>(null)
  const summary = useMemo(() => buildTodaySummary(logs, idleLogs), [idleLogs, logs])
  const pendingIdleLog = useMemo(
    () =>
      idleLogs.find(
        (log) => !log.reviewed && !log.ignored && !postponedIdleIds.includes(log.id),
      ) ?? null,
    [idleLogs, postponedIdleIds],
  )
  const llmPayload = useMemo(() => buildLlmSummaryPayload(logs, idleLogs), [idleLogs, logs])
  const llmCacheSignature = useMemo(
    () => buildLlmCacheSignature(llmPayload, llmSettings),
    [llmPayload, llmSettings],
  )
  const flows = llmFlows ?? summary.flows

  useEffect(() => {
    let active = true

    async function loadLogs() {
      try {
        const [nextLogs, nextIdleLogs] = await Promise.all([getActivityLogs(), getIdleLogs()])

        if (active) {
          setLogs(nextLogs)
          setIdleLogs(nextIdleLogs)
          setError(null)
        }
      } catch {
        if (active) {
          setError("Не удалось загрузить активности")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    const interval = window.setInterval(loadLogs, 5000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadLlmSettings() {
      try {
        const settings = await getSettings()

        if (active) {
          setLlmSettings(readLlmSettings(settings))
        }
      } catch {
        if (active) {
          setLlmSettings(DEFAULT_LLM_SETTINGS)
        }
      }
    }

    void loadLlmSettings()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    setLlmFlows(null)
    setLlmCachedAt(null)
    setLlmError(null)

    async function loadCachedSummary() {
      if (llmPayload.items.length === 0) {
        return
      }

      try {
        const cachedSummary = await getLlmSummary({
          date_key: llmPayload.date,
          payload_signature: llmCacheSignature,
          provider: llmSettings.provider,
          model: llmSettings.model,
        })

        if (!active || !cachedSummary) {
          return
        }

        const groups = parseStoredLlmGroups(cachedSummary.groups_json)
        setLlmFlows(buildFlowsFromLlmGroups(llmPayload, groups))
        setLlmCachedAt(cachedSummary.created_at)
      } catch {
        if (active) {
          setLlmError("Не удалось загрузить сохраненную группировку дня")
        }
      }
    }

    void loadCachedSummary()

    return () => {
      active = false
    }
  }, [llmCacheSignature, llmPayload, llmSettings])

  async function generateLlmSummary() {
    setLlmLoading(true)
    setLlmError(null)

    try {
      const groups = await requestOllamaSummary(llmPayload, llmSettings)
      const nextFlows = buildFlowsFromLlmGroups(llmPayload, groups)
      setLlmFlows(nextFlows)

      try {
        const savedSummary = await saveLlmSummary({
          date_key: llmPayload.date,
          payload_signature: llmCacheSignature,
          provider: llmSettings.provider,
          model: llmSettings.model,
          groups_json: serializeLlmGroups(groups),
        })
        setLlmCachedAt(savedSummary.created_at)
      } catch {
        setLlmError("Группировка получена, но не сохранилась в локальную базу")
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Не удалось получить ответ локальной модели"
      setLlmError(`Группировка дня пока не сработала: ${message}`)
    } finally {
      setLlmLoading(false)
    }
  }

  async function reviewIdleLog(input: { ignored: boolean; note: string | null }) {
    if (!pendingIdleLog) {
      return
    }

    try {
      const updatedLog = await updateIdleLog(pendingIdleLog.id, {
        ignored: input.ignored,
        note: input.note,
        reviewed: true,
      })

      setIdleLogs((currentLogs) =>
        currentLogs.map((log) => (log.id === updatedLog.id ? updatedLog : log)),
      )
      setPostponedIdleIds((currentIds) => currentIds.filter((id) => id !== updatedLog.id))
      setIdleNote("")
    } catch {
      setError("Не удалось сохранить уточнение простоя")
    }
  }

  function postponeIdleReview() {
    if (!pendingIdleLog) {
      return
    }

    setPostponedIdleIds((currentIds) =>
      currentIds.includes(pendingIdleLog.id) ? currentIds : [...currentIds, pendingIdleLog.id],
    )
    setIdleNote("")
  }

  const selectedTimelineId = selectedTimelineItem
    ? `${selectedTimelineItem.startMinutes}-${selectedTimelineItem.endMinutes}-${selectedTimelineItem.label}-${summary.timeline.findIndex((item) => item === selectedTimelineItem)}`
    : null

  const donutSegments = buildDonutSegments(flows)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {error && (
          <div className="rounded-[20px] border border-[#F0D1D1] bg-[#FFF4F4] px-4 py-3 text-sm text-[#9C4E4E]">
            {error}
          </div>
        )}

        <DayTimeline
          flows={flows}
          items={summary.timeline}
          onItemSelect={(item) => {
            setSelectedTimelineItem(item)
            setSelectedStream(null)
          }}
          selectedItemId={selectedTimelineId}
          totalTime={summary.activeTime}
        />
      </div>

      <aside className="space-y-5">
        <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          {!selectedTimelineItem && !selectedStream ? (
            <>
              <p className="font-['Georgia'] text-[1.9rem] text-[#24382F]">Твой день</p>
              <div className="mt-5">
                <FocusDonut centerLabel="Фокус" centerValue={summary.activeTime} segments={donutSegments} />
              </div>
              <div className="mt-5 space-y-3">
                <InsightMetric label="Фокус" value={summary.focusPercent} />
                <InsightMetric label="Активно" value={summary.activeTime} />
                <InsightMetric label="Простой" value={summary.idleTime} />
              </div>
              {(llmCachedAt || llmError || loading) && (
                <p className="mt-5 text-sm text-[#73867A]">
                  {llmError
                    ? llmError
                    : loading
                      ? "Загружаю реальные интервалы активности."
                      : llmCachedAt
                        ? `Показана последняя сохраненная группировка от ${formatCacheTime(llmCachedAt)}.`
                        : "Когда появятся записи, здесь можно будет собрать потоки дня."}
                </p>
              )}
            </>
          ) : selectedTimelineItem ? (
            <TimelineInspector item={selectedTimelineItem} onReset={() => setSelectedTimelineItem(null)} />
          ) : selectedStream ? (
            <StreamInspector selectedStream={selectedStream} onReset={() => setSelectedStream(null)} />
          ) : null}
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_60px_rgba(91,121,108,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-['Georgia'] text-[1.55rem] text-[#24382F]">Потоки и стримы</p>
              <p className="mt-2 text-sm text-[#71837A]">
                Здесь живет группировка дня и быстрый доступ к стримам.
              </p>
            </div>
          </div>

          <Button
            className="mt-5 w-full rounded-full"
            disabled={llmLoading || llmPayload.items.length === 0}
            onClick={() => void generateLlmSummary()}
            size="lg"
            type="button"
          >
            <Sparkles className="size-4" />
            {llmLoading ? "Собираю день" : llmCachedAt ? "Обновить группы" : "Собрать день"}
          </Button>

          <div className="mt-5 space-y-4">
            {flows.length === 0 && (
              <p className="text-sm text-[#75877D]">
                Потоки появятся после первых логов или после ручной группировки дня.
              </p>
            )}

            {flows.map((flow) => (
              <article
                className="rounded-[24px] border border-[#E2EBE4] bg-[#FBFDFB] p-4"
                key={flow.name}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: flow.accent }} />
                    <span className="font-medium text-[#2A4035]">{flow.name}</span>
                  </div>
                  <span className="text-sm text-[#687B70]">{flow.time}</span>
                </div>

                <div className="mt-4 space-y-2">
                  {flow.streams.map((stream) => (
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#E7EFE9] bg-white px-3 py-3 text-left transition hover:border-[#D3E3D8] hover:bg-[#F9FCF9]"
                      key={stream.name}
                      onClick={() => {
                        setSelectedStream({ flow, stream })
                        setSelectedTimelineItem(null)
                      }}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#263C31]">{stream.name}</p>
                        <p className="mt-1 text-xs text-[#788981]">{stream.activities} активностей</p>
                      </div>
                      <span className="shrink-0 text-sm text-[#617469]">{stream.time}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>

      {pendingIdleLog && (
        <IdleReviewDialog
          idleLog={pendingIdleLog}
          note={idleNote}
          onIgnore={() => void reviewIdleLog({ ignored: true, note: null })}
          onNoteChange={setIdleNote}
          onPostpone={postponeIdleReview}
          onSave={() =>
            void reviewIdleLog({
              ignored: false,
              note: idleNote.trim() || null,
            })
          }
        />
      )}
    </div>
  )
}

function buildDonutSegments(flows: FlowSummary[]) {
  if (flows.length === 0) {
    return [{ label: "Активно", value: 100, color: "#7CB39A" }]
  }

  const total = Math.max(
    1,
    flows.reduce((sum, flow) => sum + parseDuration(flow.time), 0),
  )

  return flows.map((flow) => ({
    label: flow.name,
    value: Math.max(1, Math.round((parseDuration(flow.time) / total) * 100)),
    color: flow.accent,
  }))
}

function parseDuration(value: string) {
  const hoursMatch = value.match(/(\d+)\s*ч/)
  const minutesMatch = value.match(/(\d+)\s*мин/)
  return Number(hoursMatch?.[1] ?? 0) * 60 + Number(minutesMatch?.[1] ?? 0)
}

function formatCacheTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <p className="text-sm text-[#73867A]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-medium text-[#253D31]">{value}</p>
    </div>
  )
}

function InspectorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3">
      <p className="text-sm text-[#73867A]">{label}</p>
      <p className="mt-2 text-[1.05rem] font-medium text-[#2B4236]">{value}</p>
    </div>
  )
}

function TimelineInspector({
  item,
  onReset,
}: {
  item: TimelineItem
  onReset: () => void
}) {
  return (
    <div>
      <button
        className="inline-flex items-center gap-2 text-sm text-[#6C7E74] transition hover:text-[#273E31]"
        onClick={onReset}
        type="button"
      >
        <ArrowRight className="size-4 rotate-180" />
        Назад к обзору
      </button>
      <p className="mt-4 font-['Georgia'] text-[1.7rem] leading-tight text-[#24382F]">{item.label}</p>
      <div className="mt-4 space-y-3">
        <InspectorMetric label="Время" value={`${item.start} - ${item.end}`} />
        <InspectorMetric label="Длительность" value={formatMinutes(item.durationMinutes)} />
        <InspectorMetric label="Поток" value={item.flow} />
        <InspectorMetric label="Источник" value={item.app} />
        {item.url && <InspectorMetric label="URL" value={item.url} />}
      </div>
    </div>
  )
}

function StreamInspector({
  selectedStream,
  onReset,
}: {
  selectedStream: SelectedStream
  onReset: () => void
}) {
  const details = selectedStream.stream.details ?? []

  return (
    <div>
      <button
        className="inline-flex items-center gap-2 text-sm text-[#6C7E74] transition hover:text-[#273E31]"
        onClick={onReset}
        type="button"
      >
        <ArrowRight className="size-4 rotate-180" />
        Назад к обзору
      </button>

      <div className="mt-4 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: selectedStream.flow.accent }} />
        <span className="text-sm text-[#6F8177]">{selectedStream.flow.name}</span>
      </div>
      <p className="mt-3 font-['Georgia'] text-[1.7rem] leading-tight text-[#24382F]">
        {selectedStream.stream.name}
      </p>

      <div className="mt-4 space-y-3">
        <InsightMetric label="Всего" value={selectedStream.stream.time} />
        <InsightMetric label="Активностей" value={String(selectedStream.stream.activities)} />
      </div>

      <div className="mt-5 space-y-3">
        {details.length === 0 && (
          <p className="text-sm text-[#74867B]">Детали этого стрима пока не собраны.</p>
        )}

        {details.map((activity, index) => (
          <div
            className="rounded-[20px] border border-[#E3ECE5] bg-[#FBFDFB] px-4 py-3"
            key={`${activity.start}-${activity.app}-${index}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#273E31]">{activity.label}</p>
                <p className="mt-1 text-xs text-[#7B8D84]">{activity.app}</p>
              </div>
              <span className="text-sm text-[#62756A]">{activity.duration}</span>
            </div>
            <p className="mt-2 text-xs text-[#87978F]">
              {activity.start} - {activity.end}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

type IdleReviewDialogProps = {
  idleLog: IdleLogRecord
  note: string
  onIgnore: () => void
  onNoteChange: (note: string) => void
  onPostpone: () => void
  onSave: () => void
}

function IdleReviewDialog({
  idleLog,
  note,
  onIgnore,
  onNoteChange,
  onPostpone,
  onSave,
}: IdleReviewDialogProps) {
  const start = formatTime(idleLog.start_time)
  const end = formatTime(idleLog.end_time)
  const duration = formatMinutes(durationMinutes(idleLog.start_time, idleLog.end_time))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203228]/25 px-4 backdrop-blur-sm">
      <section className="relative w-full max-w-md rounded-[28px] border border-white/90 bg-white p-5 shadow-[0_24px_80px_rgba(70,94,82,0.18)]">
        <Button
          aria-label="Закрыть"
          className="absolute right-4 top-4"
          onClick={onPostpone}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
        <div>
          <h2 className="font-['Georgia'] text-[1.55rem] text-[#24382F]">Уточнить простой</h2>
          <p className="mt-2 text-sm leading-6 text-[#6F8177]">
            Зафиксирован перерыв с {start} до {end}, {duration}.
          </p>
        </div>

        <textarea
          className="mt-5 min-h-28 w-full resize-none rounded-[20px] border border-[#DCE7DE] bg-[#FBFDFB] px-4 py-3 text-sm outline-none transition focus:border-[#9DC3AC]"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Например: обед, звонок, дорога"
          value={note}
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onIgnore} type="button" variant="outline">
            Игнорировать
          </Button>
          <Button onClick={onSave} type="button">
            Сохранить
          </Button>
        </div>
      </section>
    </div>
  )
}

function durationMinutes(startTime: string, endTime: string) {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return (end - start) / 60_000
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
