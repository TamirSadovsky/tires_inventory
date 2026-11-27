import assert from "node:assert/strict"
import test from "node:test"
import bcrypt from "bcryptjs"
import { createSqliteStore } from "./db.js"
import { createAuth } from "./auth.js"

test("saves a tyre and keeps the same row on a second scan", async () => {
  const store = createSqliteStore(":memory:")
  const auth = createAuth(store, "test-secret")
  await auth.ensureAdmin("admin", "admin123")
  const user = await auth.login("admin", "admin123")
  assert.equal(user.username, "admin")
  assert.equal(await auth.login("admin", "wrong"), null)

  const record = sampleTire("1803060")
  const first = store.saveTire({ ...record, scannedBy: user.id })
  const second = store.saveTire({ ...record, commercialName: "EcoContact 6", scannedBy: user.id })
  assert.equal(first.id, second.id)
  assert.equal(store.listTires().length, 1)
  assert.equal(store.listTires()[0].commercialName, "EcoContact 6")
  assert.equal(store.listBySize("205/55 R 16", "1803060").length, 0)

  store.saveTire({ ...sampleTire("999"), sizeDesignation: "205/55 R 16", scannedBy: user.id })
  assert.equal(store.listBySize("205/55 R 16", "1803060").length, 1)

  const token = auth.sign(user)
  assert.equal(auth.read(token).username, "admin")
  assert.equal(auth.read(`${token}tampered`), null)
})

function sampleTire(eprel) {
  return {
    eprelRegistrationNumber: eprel,
    sourceUrl: `https://eprel.ec.europa.eu/screen/product/tyres/${eprel}?navigatingFrom=qr`,
    brand: "Continental",
    commercialName: "",
    modelIdentifier: "0314991",
    gtin: "4019238291902",
    tyreClass: "C1",
    sizeDesignation: "205/55 R 16",
    tyreDesignation: "205/55 R 16 91 V",
    sectionWidth: 205,
    aspectRatio: 55,
    rimDiameter: 16,
    loadIndex: 91,
    loadKg: 615,
    speedSymbol: "V",
    speedKmh: 240,
    loadVersion: "SL",
    fuelClass: "A",
    wetGripClass: "B",
    noiseDb: 71,
    noiseClass: "B",
    snowTyre: false,
    iceTyre: false,
    productionWeek: 5,
    productionYear: 24,
    status: "PUBLISHED",
    organisationName: "Continental Reifen Deutschland GmbH",
    website: "www.continental-tires.com",
    summaryHe: "בדיקה",
    rawJson: "{}",
  }
}

test("password hash is not stored in clear text", async () => {
  const store = createSqliteStore(":memory:")
  const auth = createAuth(store, "test-secret")
  await auth.ensureAdmin("admin", "admin123")
  const stored = store.findUser("admin")
  assert.equal(await bcrypt.compare("admin123", stored.passwordHash), true)
  assert.notEqual(stored.passwordHash, "admin123")
})
