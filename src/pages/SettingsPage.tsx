import { settingsRows } from "@/data/mock"

export function SettingsPage() {
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Параметры приложения</h2>
        <p className="text-xs text-zinc-500">Сейчас это интерфейсный прототип настроек</p>
      </div>
      <div className="divide-y divide-zinc-100">
        {settingsRows.map((row) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={row.label}>
            <span className="text-sm text-zinc-600">{row.label}</span>
            <span className="text-sm font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

