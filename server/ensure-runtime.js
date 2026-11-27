import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const distIndex = path.join(root, "client", "dist", "index.html")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const missing = Object.keys(pkg.dependencies || {}).filter(
  (name) => !fs.existsSync(path.join(root, "node_modules", name)),
)

if (missing.length === 0 && fs.existsSync(distIndex)) {
  process.exit(0)
}

console.log(
  missing.length
    ? `Missing packages: ${missing.join(", ")}. Installing and building if needed.`
    : "The built site is missing. Installing and building.",
)
run(["install", "--include=dev"])
if (!fs.existsSync(distIndex)) run(["run", "build"])
run(["prune", "--omit=dev"])

function run(args) {
  const result = spawnSync("npm", args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
