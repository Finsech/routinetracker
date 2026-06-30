export const UI_ERROR_COPY = {
  today: {
    loadActivity: "Не удалось загрузить активность",
    loadStoredSummary: "Не удалось загрузить сохраненную группировку дня",
    localModelResponse: "Не удалось получить ответ локальной модели",
    saveIdleReview: "Не удалось сохранить уточнение простоя",
    summarySavedButNotPersisted: "Группировка получена, но не сохранилась в локальную базу",
    autoSummaryFailedPrefix: "Автосборка дня пока не сработала",
    manualSummaryFailedPrefix: "Группировка дня пока не сработала",
  },
  settings: {
    loadSettings: "Не удалось загрузить настройки",
    addStoplistApp: "Не удалось добавить приложение в стоп-лист",
    addStoplistSite: "Не удалось добавить сайт в стоп-лист",
    removeStoplistItem: "Не удалось удалить элемент из стоп-листа",
    saveLlmSettings: "Не удалось сохранить настройки LLM",
    exportData: "Не удалось подготовить экспорт данных",
    changeAutostart: "Не удалось изменить автозапуск приложения",
  },
  history: {
    loadWeek: "Не удалось загрузить недельную историю",
  },
  analytics: {
    loadDays: "Не удалось собрать аналитику по дням",
  },
} as const

export const LLM_UI_COPY = {
  buildDay: "Собрать день",
  updateGroups: "Обновить группы",
  buildingDay: "Собираю день",
} as const
