import assert from "node:assert/strict"
import test from "node:test"
import { saveInventory } from "./count.js"
import { createSqliteStore } from "./db.js"
import { createGateway } from "./gateway.js"

const MISSING = "לא נסרק צמיג או לא הוקלדה כמות במלאי לא ניתן לשמור"

test("manual count uses the count procedure and intake uses in/out", async () => {
  delete process.env.SQL_SERVER
  const store = createSqliteStore(":memory:")
  const gateway = createGateway(store)
  assert.equal(gateway.mode, "local")
  const calls = []
  const saveSfira = gateway.insertSfira.bind(gateway)
  const saveMove = gateway.insertInOut.bind(gateway)
  gateway.insertSfira = async (row) => {
    calls.push(["sfira", row])
    return saveSfira(row)
  }
  gateway.insertInOut = async (row) => {
    calls.push(["inout", row])
    return saveMove(row)
  }

  const created = await gateway.addManufacturer("CONTINENTAL")
  const manual = {
    manufacturerId: created.id,
    manufacturerName: created.name,
    size: "225/55ZR17",
    model: "COMFORT-EX",
    loadCode: "98W",
    loadVersion: "XL",
    ourId: "1803060",
  }

  const counted = await saveInventory({
    kind: "count",
    manual,
    warehouseId: 2,
    quantity: 3,
    clientId: 7,
    gateway,
  })
  assert.equal(counted.tire.description, "225/55ZR17 98W COMFORT-EX XL")
  assert.equal(counted.warehouse.id, 2)
  assert.equal(calls[0][0], "sfira")
  assert.equal(calls[0][1].wide, 225)
  assert.equal(calls[0][1].hatach, 55)
  assert.equal(calls[0][1].hight, 17)
  assert.equal(calls[0][1].quantity, 3)

  await saveInventory({ kind: "in", manual, warehouseId: 1, quantity: 2, clientId: 7, gateway })
  assert.equal(calls[1][0], "inout")
  assert.equal(calls[1][1].inOut, 1)
  assert.equal(calls[1][1].mlid, 1803060)
  assert.equal(calls[1][1].quantity, 2)
  assert.equal(calls[1][1].manufacturerDegem, 0)

  await saveInventory({
    kind: "out",
    manual: { ...manual, ourId: "לא מספר" },
    warehouseId: 1,
    quantity: 1,
    clientId: 7,
    gateway,
  })
  assert.equal(calls[2][1].inOut, 2)
  assert.equal(calls[2][1].mlid, 0)
  assert.equal(calls.length, 3)
})

test("a missing quantity is rejected before anything is saved", async () => {
  delete process.env.SQL_SERVER
  const store = createSqliteStore(":memory:")
  const gateway = createGateway(store)
  let saved = false
  gateway.insertSfira = async () => {
    saved = true
  }
  await assert.rejects(
    () => saveInventory({
      kind: "count",
      manual: { manufacturerName: "CONTINENTAL", size: "205/55R16", loadCode: "91V" },
      warehouseId: 1,
      quantity: 0,
      clientId: 7,
      gateway,
    }),
    (error) => error.message === MISSING,
  )
  assert.equal(saved, false)
})

test("an unknown warehouse is rejected", async () => {
  delete process.env.SQL_SERVER
  const gateway = createGateway(createSqliteStore(":memory:"))
  const created = await gateway.addManufacturer("HAIDA")
  await assert.rejects(
    () => saveInventory({
      kind: "in",
      manual: {
        manufacturerId: created.id,
        manufacturerName: created.name,
        size: "215/55ZR17",
        model: "EX-COMFORT",
        loadCode: "98W",
      },
      warehouseId: 9,
      quantity: 1,
      clientId: 7,
      gateway,
    }),
    (error) => error.message === "המחסן לא נמצא",
  )
})
