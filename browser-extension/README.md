# FocusFlow Browser Bridge

Minimal browser extension for the FocusFlow MVP.

It sends the active tab URL and title to the local desktop app:

```text
http://127.0.0.1:17653/browser-activity
```

## Install For Local Testing

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select this `browser-extension` folder.
5. Start FocusFlow in Tauri desktop mode and switch browser tabs.

When the bridge works, the FocusFlow settings screen shows the last received tab URL, and browser activity rows in SQLite receive the URL.
