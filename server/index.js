import "./env.js"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express from "express"
import cookieParser from "cookie-parser"
import fs from "node:fs"
import { createSqliteStore } from "./db.js"
import { createAuth } from "./auth.js"
import { createGateway } from "./gateway.js"
import { previewTire, saveInventory } from "./count.js"
import { saveHandSticker } from "./handPhoto.js"
import { createPhotoStore } from "./photos.js"
import { startHandPhotoCleanup } from "./handCleanup.js"
import { resolveManufacturer } from "./manufacturer.js"
import { sqlConfigured } from "./sql.js"
import { loginSql } from "./sqlLogin.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const port = Number(process.env.PORT || 8787)
const adminUser = process.env.ADMIN_USER || "admin"
const adminPassword = process.env.ADMIN_PASSWORD || "admin123"
const sessionSecret = process.env.SESSION_SECRET || "tire-barcode-local-session"

const store = createSqliteStore(path.join(root, "data", "tires.sqlite"))
const photos = createPhotoStore(path.join(root, "data", "stickers"))
const auth = createAuth(store, sessionSecret)
const gateway = createGateway(store)
await auth.ensureAdmin(adminUser, adminPassword)

const app = express()
app.disable("x-powered-by")
app.use("/api/hand-sticker", express.json({ limit: "12mb" }))
app.use(express.json({ limit: "1mb" }))
app.use(cookieParser())

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: gateway.mode })
})

app.post("/api/login", async (req, res) => {
  const company = String(req.body?.company || "").trim()
  const username = String(req.body?.username || "").trim()
  const password = String(req.body?.password || "")
  if (!company || !username || !password) {
    res.status(400).json({ error: "צריך למלא שם חברה, שם משתמש וסיסמה" })
    return
  }
  if (sqlConfigured()) {
    try {
      const user = await loginSql(company, username, password)
      setSession(res, user)
      res.json({ user: sessionUser(user), mode: gateway.mode })
    } catch (error) {
      sendError(res, error)
    }
    return
  }
  const local = await auth.login(username, password)
  if (!local) {
    res.status(401).json({ error: "שם משתמש או סיסמה שגויים" })
    return
  }
  const user = {
    ...local,
    company,
    clientId: Number(process.env.CLIENT_ID || 1),
  }
  setSession(res, user)
  res.json({ user: sessionUser(user), mode: gateway.mode })
})

app.post("/api/logout", (_req, res) => {
  res.clearCookie(auth.cookieName, { path: "/" })
  res.json({ ok: true })
})

app.get("/api/me", (req, res) => {
  const user = auth.read(req.cookies?.[auth.cookieName])
  if (!user) {
    res.status(401).json({ error: "נדרשת כניסה" })
    return
  }
  res.json({ user, mode: gateway.mode })
})

app.get("/api/warehouses", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const warehouses = await gateway.warehouses(req.user.clientId)
    res.json({ warehouses })
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/counts", auth.requireUser.bind(auth), async (req, res) => {
  const mode = req.body?.mode === "new" ? "new" : "continue"
  try {
    if (mode === "new") await gateway.startCount(req.user.clientId)
    res.json({ ok: true, mode })
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/manufacturers", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const manufacturers = await gateway.listManufacturers(req.user.clientId)
    res.json({ manufacturers })
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/manufacturers", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const manufacturer = await resolveManufacturer(req.body?.name, gateway)
    res.json({ manufacturer })
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/preview", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const preview = await previewTire(req.body?.code)
    res.json(preview)
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/sfira", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const saved = await saveInventory({
      kind: "count",
      code: req.body?.code,
      manual: req.body?.manual,
      warehouseId: req.body?.warehouseId,
      quantity: req.body?.quantity,
      clientId: req.user.clientId,
      gateway,
    })
    res.json(saved)
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/hand-sticker", auth.requireUser.bind(auth), async (req, res) => {
  try {
    const saved = await saveHandSticker({
      image: req.body?.image,
      warehouseId: req.body?.warehouseId,
      quantity: req.body?.quantity,
      clientId: req.user.clientId,
      gateway,
      photos,
    })
    res.json(saved)
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/inout", auth.requireUser.bind(auth), async (req, res) => {
  const direction = req.body?.direction
  if (direction !== "in" && direction !== "out") {
    res.status(400).json({ error: "צריך לבחור קליטה או הוצאה" })
    return
  }
  try {
    const saved = await saveInventory({
      kind: direction,
      code: req.body?.code,
      manual: req.body?.manual,
      warehouseId: req.body?.warehouseId,
      quantity: req.body?.quantity,
      clientId: req.user.clientId,
      gateway,
    })
    res.json(saved)
  } catch (error) {
    sendError(res, error)
  }
})

app.use("/stickers", express.static(path.join(root, "data", "stickers")))

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "הנתיב לא קיים" })
})

const dist = path.join(root, "client", "dist")
app.use(express.static(dist))
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return
  const index = path.join(dist, "index.html")
  if (fs.existsSync(index)) {
    res.sendFile(index)
    return
  }
  res
    .type("html")
    .send(
      '<!doctype html><meta charset="utf-8"><p dir="rtl">ממשק הפיתוח זמין ב-<a href="http://localhost:5173">localhost:5173</a></p>',
    )
})

function setSession(res, user) {
  res.cookie(auth.cookieName, auth.sign(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function sessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    clientId: user.clientId,
    company: user.company,
  }
}

function sendError(res, error) {
  const status = error.status || 500
  if (status >= 500) console.error(error)
  const message = status >= 500 && !error.expose ? "הפעולה מול המסד נכשלה" : error.message
  res.status(status).json({
    error: message || "הפעולה נכשלה",
    code: error.code || undefined,
    ourId: error.ourId || undefined,
  })
}

const server = app.listen(port, () => {
  console.log(`Tire Barcode on http://localhost:${port} (${gateway.mode})`)
})

const stopHandPhotoCleanup = startHandPhotoCleanup({ gateway, photos })
server.on("close", stopHandPhotoCleanup)

server.on("error", (error) => {
  console.error(error.message)
  process.exit(1)
})
