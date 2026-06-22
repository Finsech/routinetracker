import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  AppWindow,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Monitor,
  MousePointer2,
  Play,
  Settings,
  ShieldCheck,
  Square,
  TimerReset,
} from "lucide-react"

import { StatusLine } from "@/components/app/StatusLine"
import { Button } from "@/components/ui/button"
import {
  getTrackingStatus,
  startTracking,
  stopTracking,
  type TrackerStatusRecord,
} from "@/lib/focusflow-api"
import type { NavItem, View } from "@/types"

const initialTrackerStatus: TrackerStatusRecord = {
  running: false,
  current_app: null,
  current_window_title: null,
  idle_seconds: 0,
}

const navItems: NavItem[] = [
  { id: "today", label: "Сегодня", icon: CalendarDays },
  { id: "history", label: "История", icon: History },
  { id: "settings", label: "Настройки", icon: Settings },
]

const viewTitles: Record<View, string> = {
  today: "Дневной обзор",
  history: "История активности",
  settings: "Настройки",
}

type AppShellProps = {
  activeView: View
  children: ReactNode
  onViewChange: (view: View) => void
}

export function AppShell({ activeView, children, onViewChange }: AppShellProps) {
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatusRecord>(initialTrackerStatus)
  const [trackerBusy, setTrackerBusy] = useState(false)
  const trackerRunning = trackerStatus.running

  useEffect(() => {
    let active = true

    async function refreshStatus() {
      try {
        const status = await getTrackingStatus()

        if (active) {
          setTrackerStatus(status)
        }
      } catch {
        if (active) {
          setTrackerStatus(initialTrackerStatus)
        }
      }
    }

    void refreshStatus()
    const interval = window.setInterval(refreshStatus, 2000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  async function toggleTracking() {
    setTrackerBusy(true)

    try {
      if (trackerRunning) {
        await stopTracking()
      } else {
        await startTracking()
      }

      setTrackerStatus(await getTrackingStatus())
    } finally {
      setTrackerBusy(false)
    }
  }

  const currentActivity = formatCurrentActivity(trackerStatus)
  const idleTime = formatIdleTime(trackerStatus.idle_seconds)

  return (
    <main className="min-h-screen bg-[#F7F8F5] text-zinc-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white px-4 py-5 lg:block">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#22C55E] text-white">
              <TimerReset className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">FocusFlow</p>
              <p className="text-xs text-zinc-500">локальный трекер времени</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeView === item.id

              return (
                <button
                  className={`flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm transition ${
                    active
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  type="button"
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-8 border-t border-zinc-200 pt-5">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Статус</p>
            <div className="mt-3 space-y-3 text-sm">
              <StatusLine
                icon={Monitor}
                label="Трекинг"
                value={trackerRunning ? "включен" : "выключен"}
              />
              <StatusLine icon={AppWindow} label="Сейчас" value={currentActivity} />
              <StatusLine icon={MousePointer2} label="Idle" value={idleTime} />
              <StatusLine icon={Brain} label="LLM" value="мок-данные" />
              <StatusLine icon={ShieldCheck} label="Приватность" value="локально" />
            </div>
            <Button
              className="mt-4 w-full"
              disabled={trackerBusy}
              onClick={toggleTracking}
              size="sm"
              variant={trackerRunning ? "outline" : "default"}
            >
              {trackerRunning ? <Square className="size-4" /> : <Play className="size-4" />}
              {trackerRunning ? "Остановить" : "Запустить"}
            </Button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
            <div>
              <h1 className="text-base font-semibold sm:text-lg">{viewTitles[activeView]}</h1>
              <p className="hidden text-sm text-zinc-500 sm:block">
                Вторник, 23 июня 2026
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" aria-label="Предыдущий день">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline">
                <CalendarDays className="size-4" />
                Сегодня
              </Button>
              <Button size="icon" variant="outline" aria-label="Следующий день">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </header>

          <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  variant={activeView === item.id ? "default" : "ghost"}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              )
            })}
          </div>

          <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
        </section>
      </div>
    </main>
  )
}

function formatCurrentActivity(status: TrackerStatusRecord) {
  if (!status.current_app) {
    return "нет сессии"
  }

  if (!status.current_window_title) {
    return status.current_app
  }

  const title =
    status.current_window_title.length > 32
      ? `${status.current_window_title.slice(0, 32)}...`
      : status.current_window_title

  return `${status.current_app}: ${title}`
}

function formatIdleTime(seconds: number) {
  if (seconds < 60) {
    return `${seconds} с`
  }

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${minutes} мин ${restSeconds} с`
}
