import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const INCLUDE_DIRS = ["src", "src-tauri", ".github"]
const INCLUDE_FILES = [
  "README.md",
  "REFACTORING_SPEC.md",
  "MACOS_BUILD.md",
  "RELEASE_NOTES.md",
  "GITHUB_COPY.md",
]
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".rs", ".yml", ".yaml"])
const SUSPICIOUS_PATTERNS = [
  /Рџ/g,
  /РЎ/g,
  /Рќ/g,
  /СЃ/g,
  /С‚/g,
  /СЏ/g,
  /вЂ/g,
]
const KNOWN_DEBT_FILES = new Set(["ROADMAP.md", "SPECIFICATION.md"])

const issues = []

for (const dir of INCLUDE_DIRS) {
  walk(path.join(ROOT, dir))
}

for (const file of INCLUDE_FILES) {
  const absolutePath = path.join(ROOT, file)
  if (fs.existsSync(absolutePath)) {
    checkFile(absolutePath)
  }
}

if (issues.length > 0) {
  console.error("Found suspicious mojibake-like strings:")
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} -> ${issue.snippet}`)
  }
  process.exit(1)
}

console.log("No suspicious mojibake-like strings found.")

function walk(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return
  }

  const stat = fs.statSync(targetPath)
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      walk(path.join(targetPath, entry))
    }
    return
  }

  if (!EXTENSIONS.has(path.extname(targetPath))) {
    return
  }

  checkFile(targetPath)
}

function checkFile(targetPath) {
  const relativePath = path.relative(ROOT, targetPath)
  if (KNOWN_DEBT_FILES.has(relativePath)) {
    return
  }
  const content = fs.readFileSync(targetPath, "utf8")
  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    if (SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(line))) {
      issues.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim().slice(0, 160),
      })
    }
  })
}
