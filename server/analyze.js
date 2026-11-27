import {
  LOAD_KG,
  LOAD_VERSION_HE,
  SPEED_KMH,
  TYRE_CLASS_HE,
  fuelInfo,
  fullProductionYear,
  gradeRank,
  noiseInfo,
  wetInfo,
} from "./standards.js"

export function normalizeTyre(product, openUrl) {
  const extra = product.additionalDetails || {}
  const contact = product.contactDetails || {}
  const organisation = product.organisation || {}
  return {
    eprelRegistrationNumber: String(product.eprelRegistrationNumber || ""),
    sourceUrl: openUrl || "",
    brand: text(product.supplierOrTrademark),
    commercialName: text(extra.commercialName),
    modelIdentifier: text(product.modelIdentifier),
    gtin: text(extra.gtinIdentifier),
    tyreClass: text(product.tyreClass).toUpperCase(),
    sizeDesignation: text(product.sizeDesignation),
    tyreDesignation: text(product.tyreDesignation),
    sectionWidth: numberOrNull(product.tyreSection),
    aspectRatio: numberOrNull(product.aspectRatio),
    rimDiameter: numberOrNull(product.rimDiameter),
    loadIndex: numberOrNull(product.loadCapacityIndex),
    speedSymbol: text(product.speedCategorySymbol).toUpperCase(),
    loadVersion: text(product.loadCapacityIndicator).toUpperCase(),
    fuelClass: text(product.energyClass).toUpperCase(),
    wetGripClass: text(product.wetGripClass).toUpperCase(),
    noiseDb: numberOrNull(product.externalRollingNoiseValue),
    noiseClass: text(product.externalRollingNoiseClass).toUpperCase(),
    snowTyre: Boolean(product.severeSnowTyre),
    iceTyre: Boolean(product.iceTyre),
    productionWeek: numberOrNull(product.dateStartProductionWeek),
    productionYear: numberOrNull(product.dateStartProductionYear),
    status: text(product.status),
    organisationName: text(organisation.organisationName || contact.serviceName),
    website: text(contact.webSiteURL),
    rawJson: JSON.stringify(product),
  }
}

export function analyzeTyre(product, peers = [], openUrl = "") {
  const tire = normalizeTyre(product, openUrl)
  const loadKg = LOAD_KG[tire.loadIndex] ?? null
  const speedKmh = SPEED_KMH[tire.speedSymbol] ?? null
  const fuel = fuelInfo(tire.fuelClass)
  const wet = wetInfo(tire.wetGripClass)
  const noise = noiseInfo(tire.noiseDb, tire.noiseClass)
  const year = fullProductionYear(tire.productionYear)
  const comparisons = peers
    .filter((peer) => peer.eprelRegistrationNumber !== tire.eprelRegistrationNumber)
    .map((peer) => comparePeer(tire, peer))
    .filter(Boolean)

  const name = [tire.brand, tire.commercialName].filter(Boolean).join(" ")
  const lines = []
  if (name) lines.push(name)
  lines.push(sizeLine(tire, loadKg, speedKmh))
  if (tire.fuelClass) lines.push(`חיסכון בדלק: ${tire.fuelClass}. ${fuel.text}`.trim())
  if (tire.wetGripClass) lines.push(`אחיזה ברטוב: ${tire.wetGripClass}. ${wet.text}`.trim())
  if (tire.noiseDb != null || tire.noiseClass) {
    lines.push(
      `רעש חיצוני: ${tire.noiseDb ?? "—"} dB, דרגה ${tire.noiseClass || "—"}. ${noise.text}`.trim(),
    )
  }
  if (TYRE_CLASS_HE[tire.tyreClass]) lines.push(TYRE_CLASS_HE[tire.tyreClass])
  if (tire.loadVersion) {
    const label = LOAD_VERSION_HE[tire.loadVersion]
    lines.push(label ? `סימון עומס: ${tire.loadVersion}, ${label}.` : `סימון עומס: ${tire.loadVersion}.`)
  }
  lines.push(tire.snowTyre ? "מסומן לצמיג שלג חמור." : "אין סימון צמיג שלג חמור.")
  if (tire.iceTyre) lines.push("מסומן לתנאי קרח קשים.")
  if (tire.productionWeek && year) {
    const dot = `${String(tire.productionWeek).padStart(2, "0")}${String(year).slice(-2)}`
    lines.push(`תחילת ייצור: שבוע ${tire.productionWeek} בשנת ${year} (${dot}).`)
  }
  if (tire.gtin) lines.push(`ברקוד מוצר: ${ltr(tire.gtin)}.`)
  lines.push(...comparisons)

  return {
    tire: { ...tire, loadKg, speedKmh, productionYearFull: year },
    fuel,
    wet,
    noise,
    comparisons,
    summaryHe: lines.filter(Boolean).join("\n"),
  }
}

function sizeLine(tire, loadKg, speedKmh) {
  const size = tire.sizeDesignation ? ltr(tire.sizeDesignation) : "לא צוינה"
  const load = tire.loadIndex
    ? `עומס ${tire.loadIndex}${loadKg ? ` (${loadKg} ק"ג)` : ""}`
    : "עומס לא צוין"
  const speed = tire.speedSymbol
    ? `מהירות ${tire.speedSymbol}${speedKmh ? ` (עד ${speedKmh} קמ"ש)` : ""}`
    : "מהירות לא צוינה"
  return `מידה ${size}, ${load}, ${speed}.`
}

function comparePeer(tire, peer) {
  const bits = []
  const fuelDelta = (gradeRank(tire.fuelClass) ?? 0) - (gradeRank(peer.fuelClass) ?? 0)
  if (tire.fuelClass && peer.fuelClass && fuelDelta > 0) bits.push("חסכוני יותר בדלק")
  if (tire.fuelClass && peer.fuelClass && fuelDelta < 0) bits.push("פחות חסכוני בדלק")
  const wetDelta = (gradeRank(tire.wetGripClass) ?? 0) - (gradeRank(peer.wetGripClass) ?? 0)
  if (tire.wetGripClass && peer.wetGripClass && wetDelta > 0) bits.push("אחיזה טובה יותר ברטוב")
  if (tire.wetGripClass && peer.wetGripClass && wetDelta < 0) bits.push("אחיזה חלשה יותר ברטוב")
  if (tire.noiseDb != null && peer.noiseDb != null && tire.noiseDb !== peer.noiseDb) {
    bits.push(tire.noiseDb < peer.noiseDb ? "שקט יותר" : "רועש יותר")
  }
  const other = [peer.brand, peer.commercialName].filter(Boolean).join(" ") || "צמיג אחר"
  if (!bits.length) {
    return `במידה ${ltr(tire.sizeDesignation)} כבר שמור ${other} עם אותן דרגות דלק, רטוב ורעש.`
  }
  return `לעומת ${other} שכבר שמור במידה הזו: ${bits.join(", ")}.`
}

function ltr(value) {
  return `\u2066${value}\u2069`
}

function text(value) {
  return value == null ? "" : String(value).trim()
}

function numberOrNull(value) {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
