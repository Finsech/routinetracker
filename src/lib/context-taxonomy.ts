const COMMUNICATION_APPS = new Set([
  "telegram",
  "telegramdesktop",
  "slack",
  "whatsapp",
  "discord",
  "max",
  "maxmessenger",
  "yandexmessenger",
  "yamb",
  "tamtam",
])

const COMMUNICATION_DOMAINS = [
  "web.telegram.org",
  "t.me",
  "slack.com",
  "app.slack.com",
  "discord.com",
  "discordapp.com",
  "web.whatsapp.com",
  "whatsapp.com",
  "web.max.ru",
  "max.ru",
  "messenger.yandex.ru",
]

const PRODUCT_NOISE_PARTS = new Set([
  "telegram",
  "slack",
  "discord",
  "whatsapp",
  "max",
  "yandex messenger",
  "яндекс мессенджер",
  "notion",
  "figma",
  "github",
  "gitlab",
  "linear",
  "cursor",
  "visual studio code",
  "code",
  "google docs",
  "google sheets",
  "google slides",
  "google drive",
  "docs",
  "browser",
  "chrome",
  "edge",
  "firefox",
  "safari",
])

export type FlowHint = "Work" | "Learning" | "Communication" | "Entertainment" | "Routine"

export type ContextHints = {
  normalizedApp: string
  domain: string | null
  hintFlow: FlowHint | null
  projectHint: string | null
}

export function buildContextHints(app: string, url: string | null, title: string | null): ContextHints {
  const normalizedApp = normalizeAppName(app)
  const domain = safeHostname(url)
  const communication = isCommunicationApp(normalizedApp) || isCommunicationDomain(domain)

  return {
    normalizedApp,
    domain,
    hintFlow: communication ? "Communication" : null,
    projectHint: communication ? null : extractProjectHint(title, normalizedApp, domain),
  }
}

export function normalizeAppName(app: string) {
  return app.trim().toLowerCase().replace(/\.exe$/i, "").replace(/\.app$/i, "")
}

export function safeHostname(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return null
  }
}

export function isCommunicationApp(normalizedApp: string) {
  return COMMUNICATION_APPS.has(normalizedApp)
}

export function isCommunicationDomain(domain: string | null) {
  if (!domain) {
    return false
  }

  return COMMUNICATION_DOMAINS.some(
    (candidate) => domain === candidate || domain.endsWith(`.${candidate}`),
  )
}

function extractProjectHint(title: string | null, normalizedApp: string, domain: string | null) {
  if (!title) {
    return null
  }

  const parts = title
    .split(/\s+[—–|-]\s+|\s+\|\s+|\s+·\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  const filtered = parts.filter((part) => {
    const normalizedPart = part.toLowerCase()

    if (normalizedPart.length < 4) {
      return false
    }

    if (PRODUCT_NOISE_PARTS.has(normalizedPart)) {
      return false
    }

    if (domain && normalizedPart === domain) {
      return false
    }

    if (normalizedPart === normalizedApp || normalizedPart === `${normalizedApp}.exe`) {
      return false
    }

    return /[a-zа-яё0-9]/i.test(normalizedPart)
  })

  if (filtered.length === 0) {
    return null
  }

  return filtered.sort((left, right) => right.length - left.length)[0] ?? null
}

