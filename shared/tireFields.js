export function parseSize(value) {
  const compact = String(value || "").replace(/\s+/g, "")
  const match = compact.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(Z?R)(\d{1,2}(?:\.\d+)?)/i)
  if (!match) return null
  const construction = match[3].toUpperCase()
  return {
    wide: Number(match[1]),
    hatach: Number(match[2]),
    hight: Number(match[4]),
    size: `${match[1]}/${match[2]}${construction}${match[4]}`,
  }
}

export function parseLoadCode(value) {
  const compact = String(value || "").replace(/\s+/g, "").toUpperCase()
  const match = compact.match(/^(\d+(?:\.\d+)?)([A-Z]+)$/)
  if (!match) return null
  return { strength: match[1], speed: match[2] }
}

export function buildDescription({ size, strength, speed, model, loadVersion }) {
  const extra = extraToken(loadVersion)
  return [size, `${strength || ""}${speed || ""}`, model, extra]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
}

export function tireRecordFromManual({ size, model, loadCode, loadVersion, ourId }) {
  const parsed = parseSize(size)
  if (!parsed) {
    const error = new Error("לא הצלחתי לקרוא רוחב, חתך וגובה ממידת הצמיג")
    error.status = 422
    throw error
  }
  const load = parseLoadCode(loadCode)
  if (!load) {
    const error = new Error("צריך קוד עומס ומהירות, למשל 98W")
    error.status = 422
    throw error
  }
  const description = buildDescription({
    size: parsed.size,
    strength: load.strength,
    speed: load.speed,
    model,
    loadVersion,
  })
  return {
    degem: clip(model, 80),
    description: clip(description, 250),
    wide: parsed.wide,
    hatach: parsed.hatach,
    hight: parsed.hight,
    size: clip(parsed.size, 100),
    speed: clip(load.speed, 50),
    strength: clip(load.strength, 50),
    pr: "",
    ourId: clip(ourId, 50),
    rain: "",
    fuel: "",
    noise: "",
    loadCode: `${load.strength}${load.speed}`,
    loadVersion: extraToken(loadVersion),
  }
}

export function mlidFromOurId(ourId) {
  const text = String(ourId || "").trim()
  if (!/^\d+$/.test(text)) return 0
  const value = Number(text)
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) return 0
  return value
}

export function clip(value, length) {
  return String(value || "").trim().slice(0, length)
}

function extraToken(loadVersion) {
  const value = String(loadVersion || "").trim().toUpperCase()
  if (!value || value === "SL") return ""
  return value
}
