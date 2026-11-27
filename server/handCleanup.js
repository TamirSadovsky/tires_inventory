const DEFAULT_TIME = "01:00"
const TIME_ZONE = "Asia/Jerusalem"

export function cleanupTime(value = process.env.HAND_PHOTO_CLEANUP_AT) {
  if (value == null) return DEFAULT_TIME
  const text = String(value).trim()
  if (!text) return DEFAULT_TIME
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) return DEFAULT_TIME
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return DEFAULT_TIME
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function isExactClock(value) {
  const text = String(value ?? "").trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour <= 23 && minute <= 59
}

export function nextHandCleanupAt(now = new Date(), time = cleanupTime(), timeZone = TIME_ZONE) {
  const [hour, minute] = cleanupTime(time).split(":").map(Number)
  const local = zonedParts(now, timeZone)
  let at = zonedTimeToUtc(Number(local.year), Number(local.month), Number(local.day), hour, minute, timeZone)
  if (at.getTime() <= now.getTime()) {
    const next = nextCalendarDay(Number(local.year), Number(local.month), Number(local.day))
    at = zonedTimeToUtc(next.year, next.month, next.day, hour, minute, timeZone)
  }
  return at
}

export async function cleanupHandPhotos({ gateway, photos, log = console }) {
  if (gateway.mode === "sql" && photos.mode !== "azure") {
    log.error("Hand photo cleanup skipped: Azure storage is not configured")
    return { skipped: "storage" }
  }
  return gateway.withHandCleanupLock(async () => {
    const rows = await gateway.listHandPhotosToDelete()
    const counts = { listed: rows.length, deleted: 0, missing: 0, skipped: 0, failed: 0 }
    for (const row of rows) {
      let outcome = "failed"
      try {
        outcome = await photos.removeByLink(row.picLink)
      } catch (error) {
        log.error(error)
      }
      if (!(outcome in counts)) outcome = "failed"
      counts[outcome] += 1
    }
    await gateway.deleteHandPhotosMarked()
    log.log(
      `Hand photo cleanup: listed ${counts.listed}, deleted ${counts.deleted}, missing ${counts.missing}, skipped ${counts.skipped}, failed ${counts.failed}`,
    )
    return counts
  })
}

export function startHandPhotoCleanup({ gateway, photos, time, log = console, now = () => new Date() }) {
  const configured = time ?? process.env.HAND_PHOTO_CLEANUP_AT
  const clock = cleanupTime(configured)
  if (configured != null && String(configured).trim() && !isExactClock(configured)) {
    log.error(`HAND_PHOTO_CLEANUP_AT is invalid. Using ${DEFAULT_TIME}.`)
  }
  let timer
  let stopped = false
  const schedule = () => {
    if (stopped) return
    const at = nextHandCleanupAt(now(), clock)
    const delay = Math.max(1000, at.getTime() - now().getTime())
    log.log(`Hand photo cleanup scheduled at ${clock} ${TIME_ZONE} (${at.toISOString()})`)
    timer = setTimeout(async () => {
      try {
        await cleanupHandPhotos({ gateway, photos, log })
      } catch (error) {
        log.error(error)
      }
      schedule()
    }, delay)
    timer.unref?.()
  }
  schedule()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

function zonedParts(date, timeZone) {
  const map = {}
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value
  }
  if (map.hour === "24") map.hour = "00"
  return map
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  let result = utcGuess - zoneOffset(new Date(utcGuess), timeZone)
  result = utcGuess - zoneOffset(new Date(result), timeZone)
  return new Date(result)
}

function zoneOffset(date, timeZone) {
  const parts = zonedParts(date, timeZone)
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

function nextCalendarDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}
