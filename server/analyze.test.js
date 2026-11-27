import assert from "node:assert/strict"
import test from "node:test"
import { analyzeTyre } from "./analyze.js"
import { resolveScan } from "./eprel.js"

const exampleUrl = "https://eprel.ec.europa.eu/screen/product/tyres/1803060?navigatingFrom=qr"

test("resolves an EPREL screen link from a tyre QR", () => {
  const resolved = resolveScan(exampleUrl)
  assert.equal(resolved.registrationNumber, "1803060")
  assert.equal(
    resolved.openUrl,
    "https://eprel.ec.europa.eu/screen/product/tyres/1803060?navigatingFrom=qr",
  )
})

test("treats a short number as an EPREL registration", () => {
  assert.equal(resolveScan("1803060").kind, "eprel")
})

test("does not open a product barcode as an EPREL page", () => {
  const resolved = resolveScan("4019238291902")
  assert.equal(resolved.kind, "gtin")
  assert.equal(resolved.openUrl, null)
})

test("rejects a link outside EPREL", () => {
  assert.equal(resolveScan("https://example.com/tyre").kind, "foreign-url")
})

test("analyzes the Continental example fields", () => {
  const analysis = analyzeTyre({
    eprelRegistrationNumber: "1803060",
    supplierOrTrademark: "Continental",
    tyreClass: "C1",
    energyClass: "A",
    wetGripClass: "B",
    externalRollingNoiseValue: 71,
    externalRollingNoiseClass: "B",
    tyreSection: 205,
    aspectRatio: 55,
    rimDiameter: 16,
    loadCapacityIndex: 91,
    speedCategorySymbol: "V",
    loadCapacityIndicator: "SL",
    sizeDesignation: "205/55 R 16",
    tyreDesignation: "205/55 R 16 91 V",
    severeSnowTyre: false,
    iceTyre: false,
    dateStartProductionWeek: 5,
    dateStartProductionYear: 24,
    status: "PUBLISHED",
    additionalDetails: {
      commercialName: "EcoContact 6",
      gtinIdentifier: "4019238291902",
    },
    organisation: { organisationName: "Continental Reifen Deutschland GmbH" },
    contactDetails: { webSiteURL: "www.continental-tires.com" },
  }, [], exampleUrl)

  assert.equal(analysis.tire.brand, "Continental")
  assert.equal(analysis.tire.commercialName, "EcoContact 6")
  assert.equal(analysis.tire.loadKg, 615)
  assert.equal(analysis.tire.speedKmh, 240)
  assert.equal(analysis.tire.productionYearFull, 2024)
  assert.match(analysis.summaryHe, /חיסכון בדלק: A/)
  assert.match(analysis.summaryHe, /אחיזה ברטוב: B/)
  assert.match(analysis.summaryHe, /71 dB/)
  assert.match(analysis.summaryHe, /אין סימון צמיג שלג/)
})

test("compares a new tyre with one already stored in the same size", () => {
  const analysis = analyzeTyre(
    {
      eprelRegistrationNumber: "2",
      supplierOrTrademark: "Lenston",
      energyClass: "D",
      wetGripClass: "C",
      externalRollingNoiseValue: 70,
      externalRollingNoiseClass: "B",
      sizeDesignation: "215/65 R 16",
      loadCapacityIndex: 98,
      speedCategorySymbol: "H",
      additionalDetails: { commercialName: "Eagle L100+" },
    },
    [
      {
        eprelRegistrationNumber: "1",
        brand: "Lykeen",
        commercialName: "Grand Centurion AT",
        fuelClass: "C",
        wetGripClass: "C",
        noiseDb: 71,
        sizeDesignation: "215/65 R 16",
      },
    ],
  )
  assert.match(analysis.summaryHe, /פחות חסכוני בדלק/)
  assert.match(analysis.summaryHe, /שקט יותר/)
})
