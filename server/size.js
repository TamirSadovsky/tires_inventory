import { normalizeTyre } from "./analyze.js"
import { buildDescription, clip, parseSize } from "../shared/tireFields.js"

export {
  buildDescription,
  mlidFromOurId,
  parseLoadCode,
  parseSize,
  tireRecordFromManual,
} from "../shared/tireFields.js"

export function tireRecordFromProduct(product) {
  const tire = normalizeTyre(product, "")
  const parsed = parseSize(tire.sizeDesignation || tire.tyreDesignation)
  if (!parsed) {
    const error = new Error("לא הצלחתי לקרוא רוחב, חתך וגובה ממידת הצמיג")
    error.status = 422
    throw error
  }
  const strength = tire.loadIndex == null ? "" : String(tire.loadIndex)
  const speed = tire.speedSymbol || ""
  const model = tire.commercialName || tire.modelIdentifier || ""
  const description = buildDescription({
    size: parsed.size,
    strength,
    speed,
    model,
    loadVersion: tire.loadVersion,
  })
  return {
    manufacturerName: clip(tire.brand, 30),
    degem: clip(model, 80),
    description: clip(description, 250),
    wide: parsed.wide,
    hatach: parsed.hatach,
    hight: parsed.hight,
    size: clip(parsed.size, 100),
    speed: clip(speed, 50),
    strength: clip(strength, 50),
    pr: "",
    ourId: clip(tire.eprelRegistrationNumber, 50),
    rain: clip(tire.wetGripClass, 10),
    fuel: clip(tire.fuelClass, 10),
    noise: clip(noiseValue(tire), 10),
    loadCode: `${strength}${speed}`,
    loadVersion: tire.loadVersion || "",
  }
}

function noiseValue(tire) {
  return [tire.noiseDb ?? "", tire.noiseClass || ""].filter((part) => part !== "").join(" ")
}
