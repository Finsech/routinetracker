import { useState } from "react"

import { AppShell } from "@/components/app/AppShell"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { HistoryPage } from "@/pages/HistoryPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { TodayPage } from "@/pages/TodayPage"
import type { View } from "@/types"

function App() {
  const [view, setView] = useState<View>("today")

  return (
    <AppShell activeView={view} onViewChange={setView}>
      {view === "today" && <TodayPage />}
      {view === "week" && <HistoryPage />}
      {view === "analytics" && <AnalyticsPage />}
      {view === "settings" && <SettingsPage />}
    </AppShell>
  )
}

export default App
