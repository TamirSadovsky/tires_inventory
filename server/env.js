import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envFile = path.join(root, ".env")

if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (process.env[key] == null) process.env[key] = value
  }
}

if (!process.env.SQL_SERVER && process.env.DB_SERVER) process.env.SQL_SERVER = process.env.DB_SERVER
if (!process.env.SQL_PORT && process.env.DB_PORT) process.env.SQL_PORT = process.env.DB_PORT
if (!process.env.SQL_USER && process.env.DB_USER) process.env.SQL_USER = process.env.DB_USER
if (!process.env.SQL_PASSWORD && process.env.DB_PASSWORD) process.env.SQL_PASSWORD = process.env.DB_PASSWORD
if (!process.env.SQL_DATABASE && process.env.DB_NAME) process.env.SQL_DATABASE = process.env.DB_NAME
