import assert from "node:assert/strict"
import test from "node:test"
import { createSqliteStore } from "./db.js"
import { resolveManufacturer } from "./manufacturer.js"
import { mlidFromOurId, parseLoadCode, parseSize, tireRecordFromManual, tireRecordFromProduct } from "./size.js"

test("splits 215/55ZR17 into width, section and rim", () => {
  const parsed = parseSize("215/55ZR17")
  assert.deepEqual(
    { wide: parsed.wide, hatach: parsed.hatach, hight: parsed.hight, size: parsed.size },
    { wide: 215, hatach: 55, hight: 17, size: "215/55ZR17" },
  )
})

test("splits a spaced size without swallowing the load index", () => {
  const parsed = parseSize("205/55 R 16 91 V")
  assert.equal(parsed.size, "205/55R16")
  assert.equal(parsed.hight, 16)
})

test("builds the inventory description from the label fields", () => {
  const record = tireRecordFromProduct({
    eprelRegistrationNumber: "2465719",
    supplierOrTrademark: "HAIDA",
    energyClass: "C",
    wetGripClass: "C",
    externalRollingNoiseValue: 72,
    externalRollingNoiseClass: "B",
    sizeDesignation: "215/55ZR17",
    loadCapacityIndex: 98,
    speedCategorySymbol: "W",
    loadCapacityIndicator: "XL",
    additionalDetails: { commercialName: "EX-COMFORT" },
  })
  assert.equal(record.description, "215/55ZR17 98W EX-COMFORT XL")
  assert.equal(record.wide, 215)
  assert.equal(record.hatach, 55)
  assert.equal(record.hight, 17)
  assert.equal(record.ourId, "2465719")
  assert.equal(record.loadCode, "98W")
})

test("leaves standard load out of the description", () => {
  const record = tireRecordFromProduct({
    eprelRegistrationNumber: "1",
    supplierOrTrademark: "Compasal",
    sizeDesignation: "185/65R14",
    loadCapacityIndex: 86,
    speedCategorySymbol: "H",
    loadCapacityIndicator: "SL",
    additionalDetails: { commercialName: "BLAZER HP" },
  })
  assert.equal(record.description, "185/65R14 86H BLAZER HP")
})

test("builds a manual tire and keeps the extra load token", () => {
  const record = tireRecordFromManual({
    size: "225/55 ZR17",
    model: "COMFORT-EX",
    loadCode: "98 W",
    loadVersion: "XL",
    ourId: "1803060",
  })
  assert.equal(record.description, "225/55ZR17 98W COMFORT-EX XL")
  assert.equal(record.wide, 225)
  assert.equal(record.hatach, 55)
  assert.equal(record.hight, 17)
  assert.equal(record.ourId, "1803060")
  assert.equal(parseLoadCode("91V").speed, "V")
})

test("omits standard load and uses the registration number as MLID", () => {
  const record = tireRecordFromManual({
    size: "185/65R14",
    model: "BLAZER HP",
    loadCode: "86H",
    loadVersion: "SL",
    ourId: "1803060",
  })
  assert.equal(record.description, "185/65R14 86H BLAZER HP")
  assert.equal(mlidFromOurId(record.ourId), 1803060)
  assert.equal(mlidFromOurId("71 B"), 0)
  assert.equal(mlidFromOurId(""), 0)
})

test("adds a manufacturer only when the list does not already contain it", async () => {
  const store = createSqliteStore(":memory:")
  const gateway = {
    findManufacturer: (name) => store.findLocalManufacturer(name),
    addManufacturer: (name) => store.addLocalManufacturer(name),
  }
  const first = await resolveManufacturer("HAIDA", gateway)
  const second = await resolveManufacturer("HAIDA", gateway)
  assert.equal(first.id, 1)
  assert.equal(second.id, 1)
  const other = await resolveManufacturer("Compasal", gateway)
  assert.equal(other.id, 2)
})
