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

const BROWSER_APPS = [
  "chrome",
  "msedge",
  "edge",
  "firefox",
  "opera",
  "brave",
  "vivaldi",
  "yandexbrowser",
  "arc",
  "safari",
]

const WORK_APP_PATTERNS = [
  "cursor",
  "code",
  "codium",
  "idea",
  "pycharm",
  "webstorm",
  "goland",
  "clion",
  "rider",
  "rubymine",
  "phpstorm",
  "dataspell",
  "datagrip",
  "androidstudio",
  "studio",
  "notion",
  "figma",
  "photoshop",
  "illustrator",
  "aftereffects",
  "premiere",
  "blender",
  "davinciresolve",
  "resolve",
  "calendar",
  "outlook",
  "telemost",
  "zoom",
  "teams",
  "meet",
]

const WORK_DOMAINS = [
  "github.com",
  "gitlab.com",
  "linear.app",
  "figma.com",
  "notion.so",
  "docs.google.com",
  "drive.google.com",
  "miro.com",
  "atlassian.net",
  "jira.com",
  "trello.com",
  "localhost",
  "127.0.0.1",
  "calendar.google.com",
  "meet.google.com",
  "calendar.yandex.ru",
  "telemost.yandex.ru",
  "teams.microsoft.com",
  "zoom.us",
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
  "calendar",
  "meet",
  "telemost",
  "zoom",
  "teams",
])

const URL_NOISE_PARTS = new Set([
  "u",
  "d",
  "file",
  "files",
  "doc",
  "docs",
  "edit",
  "view",
  "board",
  "boards",
  "project",
  "projects",
  "browse",
  "issues",
  "issue",
  "task",
  "tasks",
  "calendar",
  "meeting",
  "meet",
  "call",
  "app",
  "workspace",
  "spaces",
])

export type FlowHint = "Work" | "Learning" | "Communication" | "Entertainment" | "Routine"

export type ContextHints = {
  normalizedApp: string
  domain: string | null
  hintFlow: FlowHint | null
  projectHint: string | null
  projectKey: string | null
}

export function buildContextHints(app: string, url: string | null, title: string | null): ContextHints {
  const normalizedApp = normalizeAppName(app)
  const domain = safeHostname(url)
  const communication = isCommunicationApp(normalizedApp) || isCommunicationDomain(domain)
  const workCandidate = isWorkCandidateApp(normalizedApp) || isWorkCandidateDomain(domain)
  const projectHint = communication ? null : extractProjectHint(title, normalizedApp, domain, url)

  return {
    normalizedApp,
    domain,
    hintFlow: communication ? "Communication" : workCandidate ? "Work" : null,
    projectHint,
    projectKey: projectHint ? normalizeProjectKey(projectHint, url, domain) : null,
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

  return COMMUNICATION_DOMAINS.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
}

export function isBrowserApp(normalizedApp: string) {
  return BROWSER_APPS.includes(normalizedApp)
}

export function isWorkCandidateApp(normalizedApp: string) {
  return isBrowserApp(normalizedApp) || WORK_APP_PATTERNS.some((pattern) => normalizedApp.includes(pattern))
}

export function isWorkCandidateDomain(domain: string | null) {
  if (!domain) {
    return false
  }

  return WORK_DOMAINS.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))
}

export function normalizeProjectKey(hint: string, url: string | null, domain: string | null) {
  const alias = extractAliasToken(hint) ?? extractProjectHintFromUrl(url)
  const base = alias ?? hint
  const normalized = base
    .toLowerCase()
    .replace(/[_/]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  if (normalized && (!domain || normalized !== domain)) {
    return normalized
  }

  return normalized || null
}

function extractProjectHint(
  title: string | null,
  normalizedApp: string,
  domain: string | null,
  url: string | null,
) {
  const urlHint = extractProjectHintFromUrl(url)

  if (!title) {
    return urlHint
  }

  const parts = title
    .split(/\s+[—–-]\s+|\s+\|\s+|\s+·\s+/)
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
    return urlHint
  }

  return pickBestProjectHint(filtered, urlHint)
}

function pickBestProjectHint(candidates: string[], urlHint: string | null) {
  if (urlHint) {
    const urlKey = normalizeProjectKey(urlHint, null, null)
    const directMatch = candidates.find((candidate) => normalizeProjectKey(candidate, null, null) === urlKey)
    if (directMatch) {
      return directMatch
    }
  }

  return [...candidates].sort((left, right) => projectHintScore(right) - projectHintScore(left))[0] ?? urlHint
}

function projectHintScore(value: string) {
  const aliasToken = extractAliasToken(value)
  const aliasBonus = aliasToken ? 120 : 0
  const compactBonus = Math.max(0, 50 - Math.min(value.length, 50))
  return aliasBonus + compactBonus + value.length
}

function extractProjectHintFromUrl(url: string | null) {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname
      .split("/")
      .map((part) => decodeURIComponent(part).trim())
      .filter(Boolean)
      .filter((part) => isMeaningfulUrlPart(part))

    if (parts.length === 0) {
      return null
    }

    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase()

    if ((host === "github.com" || host === "gitlab.com") && parts.length >= 2) {
      return parts[1] ?? null
    }

    const aliasPart = parts.find((part) => Boolean(extractAliasToken(part)))
    return aliasPart ?? parts[0] ?? null
  } catch {
    return null
  }
}

function isMeaningfulUrlPart(value: string) {
  const normalized = value.toLowerCase()

  if (normalized.length < 3) {
    return false
  }

  if (URL_NOISE_PARTS.has(normalized)) {
    return false
  }

  return /[a-zа-яё0-9]/i.test(value)
}

function extractAliasToken(value: string) {
  const tokens = value.match(/[A-Za-z][A-Za-z0-9_-]{3,}/g) ?? []
  const filtered = tokens.filter((token) => !PRODUCT_NOISE_PARTS.has(token.toLowerCase()))

  if (filtered.length === 0) {
    return null
  }

  return filtered.sort((left, right) => right.length - left.length)[0] ?? null
}
