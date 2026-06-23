import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Play,
  Settings,
  Square,
  TimerReset,
} from "lucide-react"

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
  { id: "today", label: "Сегодня", icon: LayoutList },
  { id: "week", label: "Неделя", icon: CalendarDays },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "settings", label: "Настройки", icon: Settings },
]

const viewTitles: Record<View, string> = {
  today: "Сегодня",
  week: "Неделя",
  analytics: "Аналитика",
  settings: "Настройки",
}

type AppShellProps = {
  activeView: View
  children: ReactNode
  onViewChange: (view: View) => void
  selectedDate: Date
  onSelectedDateChange: (date: Date) => void
}

export function AppShell({
  activeView,
  children,
  onViewChange,
  onSelectedDateChange,
  selectedDate,
}: AppShellProps) {
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatusRecord>(initialTrackerStatus)
  const [trackerBusy, setTrackerBusy] = useState(false)
  const trackerRunning = trackerStatus.running
  const headerDate = formatHeaderDate(selectedDate, activeView)
  const idleState = formatIdleTime(trackerStatus.idle_seconds)
  const currentActivity = formatCurrentActivity(trackerStatus)
  const showDateControls = activeView !== "settings"

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

  function stepDate(direction: -1 | 1) {
    const next = new Date(selectedDate)

    if (activeView === "week") {
      next.setDate(next.getDate() + direction * 7)
    } else {
      next.setDate(next.getDate() + direction)
    }

    next.setHours(0, 0, 0, 0)
    onSelectedDateChange(next)
  }

  function resetToToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    onSelectedDateChange(today)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_left_bottom,rgba(170,220,187,0.38),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,244,228,0.55),transparent_28%),linear-gradient(180deg,#FFF9F1_0%,#F5FAF5_100%)] text-[#1F2F27]">
      <div className="flex min-h-screen gap-5 px-4 py-4 sm:px-5 lg:px-6">
        <aside className="hidden w-[92px] shrink-0 rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,248,238,0.95)_0%,rgba(215,240,223,0.88)_100%)] px-3 py-5 shadow-[0_20px_70px_rgba(91,121,108,0.1)] lg:flex lg:flex-col">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-[#DDE8DE] bg-[#FFFDF8] shadow-[0_12px_26px_rgba(191,171,132,0.18)]">
              <div className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#87D39F_0%,#65B584_100%)] text-white">
                <TimerReset className="size-4" />
              </div>
            </div>
          </div>

          <nav className="mt-10 flex flex-1 flex-col items-center gap-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeView === item.id

              return (
                <button
                  className={`group flex w-full flex-col items-center gap-2 rounded-[22px] px-2 py-3 text-xs transition ${
                    active
                      ? "bg-white/92 text-[#2E493B] shadow-[0_12px_28px_rgba(91,121,108,0.12)]"
                      : "text-[#74867B] hover:bg-white/60 hover:text-[#2E493B]"
                  }`}
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  type="button"
                >
                  <Icon className={`size-4 ${active ? "text-[#5FA57A]" : "text-[#86978D]"}`} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,252,247,0.96)_0%,rgba(255,255,255,0.92)_100%)] shadow-[0_20px_80px_rgba(91,121,108,0.1)] backdrop-blur">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ECE9E0] px-5 py-5 sm:px-6">
            <div>
              <p className="font-['Georgia'] text-[2.1rem] leading-none text-[#22372C]">
                {viewTitles[activeView]}
              </p>
              <p className="mt-2 text-sm text-[#6E8076]">{headerDate}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden max-w-[320px] rounded-full border border-[#E4ECE6] bg-white/80 px-4 py-2 text-sm text-[#6A7C72] xl:block">
                {currentActivity}
              </div>
              <div className="rounded-full border border-[#E1E8E2] bg-white/82 px-3 py-2 text-sm text-[#63756A]">
                {idleState}
              </div>
              <Button
                className="rounded-full px-4"
                disabled={trackerBusy}
                onClick={toggleTracking}
                size="lg"
                variant={trackerRunning ? "outline" : "default"}
              >
                {trackerRunning ? <Square className="size-4" /> : <Play className="size-4" />}
                {trackerRunning ? "Пауза" : "Старт"}
              </Button>
              {showDateControls && (
                <div className="flex items-center gap-2 rounded-full border border-[#E5ECE6] bg-white/82 px-2 py-2">
                  <Button
                    aria-label="Предыдущий период"
                    onClick={() => stepDate(-1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    className="rounded-full px-4"
                    onClick={resetToToday}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <CalendarDays className="size-4" />
                    Сегодня
                  </Button>
                  <Button
                    aria-label="Следующий период"
                    onClick={() => stepDate(1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-[#ECE9E0] px-4 py-3 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  type="button"
                  variant={activeView === item.id ? "default" : "outline"}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              )
            })}
          </div>

          <div className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </section>
      </div>
    </main>
  )
}

function formatCurrentActivity(status: TrackerStatusRecord) {
  if (!status.current_app) {
    return "Трекер ждет активную сессию"
  }

  if (!status.current_window_title) {
    return status.current_app
  }

  const title =
    status.current_window_title.length > 36
      ? `${status.current_window_title.slice(0, 36)}...`
      : status.current_window_title

  return `${status.current_app}: ${title}`
}

function formatIdleTime(seconds: number) {
  if (seconds <= 0) {
    return "Без простоя"
  }

  if (seconds < 60) {
    return `Простой ${seconds} с`
  }

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return `Простой ${minutes} мин ${restSeconds} с`
}

function formatHeaderDate(date: Date, view: View) {
  if (view === "week") {
    const start = startOfWeekMonday(date)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${formatShortDate(start)} - ${formatShortDate(end)}`
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  })
  const value = formatter.format(date)

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function startOfWeekMonday(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  const weekday = next.getDay()
  const shift = weekday === 0 ? -6 : 1 - weekday
  next.setDate(next.getDate() + shift)
  return next
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date)
}
