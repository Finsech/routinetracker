const BRIDGE_URL = "http://127.0.0.1:17653/browser-activity"

function detectBrowser() {
  const userAgent = globalThis.navigator?.userAgent ?? ""

  if (userAgent.includes("Edg/")) {
    return "msedge"
  }

  if (userAgent.includes("Firefox/")) {
    return "firefox"
  }

  return "chrome"
}

async function sendActiveTab() {
  const tab = await queryActiveTab()

  if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
    return
  }

  try {
    await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser: detectBrowser(),
        url: tab.url,
        title: tab.title ?? null,
      }),
    })
  } catch {
    // FocusFlow may be closed; the next tab event will retry.
  }
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs?.[0] ?? null)
    })
  })
}

chrome.tabs.onActivated.addListener(() => {
  void sendActiveTab()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    void sendActiveTab()
  }
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    void sendActiveTab()
  }
})

chrome.runtime.onStartup.addListener(() => {
  void sendActiveTab()
})

chrome.runtime.onInstalled.addListener(() => {
  void sendActiveTab()
})
