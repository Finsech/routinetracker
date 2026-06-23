import { useState } from "react"

import { AppShell } from "@/components/app/AppShell"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TodayPage } from "@/pages/TodayPage"
import type { View } from "@/types"

function App() {
  const [view, setView] = useState<View>("today")
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))

  return (
    <AppShell
      activeView={view}
      onSelectedDateChange={setSelectedDate}
      onViewChange={setView}
      selectedDate={selectedDate}
    >
      {view === "today" && <TodayPage selectedDate={selectedDate} />}
      {view === "week" && <HistoryPage selectedDate={selectedDate} />}
      {view === "analytics" && <AnalyticsPage selectedDate={selectedDate} />}
      {view === "settings" && <SettingsPage />}
    </AppShell>
  )
}

export default App

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}
