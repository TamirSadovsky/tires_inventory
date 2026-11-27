import assert from "node:assert/strict"
import test from "node:test"
import { createSqliteStore } from "./db.js"
import { createGateway } from "./gateway.js"
import { saveHandSticker } from "./handPhoto.js"

const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`

function photos() {
  const removed = []
  return {
    mode: "local",
    removed,
    async save() {
      return { url: "https://example.blob.core.windows.net/sfira/a.jpg", name: "a.jpg" }
    },
    async remove(stored) {
      removed.push(stored.name)
    },
  }
}

test("a hand sticker stores the azure link, quantity, and warehouse", async () => {
  delete process.env.SQL_SERVER
  const store = createSqliteStore(":memory:")
  const gateway = createGateway(store)
  const calls = []
  const original = gateway.insertHandPhoto.bind(gateway)
  gateway.insertHandPhoto = async (row) => {
    calls.push(row)
    return original(row)
  }
  const saved = await saveHandSticker({
    image: jpeg,
    warehouseId: 2,
    quantity: 4,
    clientId: 7,
    gateway,
    photos: photos(),
  })
  assert.equal(saved.quantity, 4)
  assert.equal(saved.warehouse.id, 2)
  assert.equal(calls[0].picLink, "https://example.blob.core.windows.net/sfira/a.jpg")
  assert.equal(calls[0].quantity, 4)
  assert.equal(calls[0].warehouseId, 2)
  assert.equal(store.listLocalHandPhotos()[0].set_on_local_app, 0)
})

test("a missing photo, a missing quantity, and a failed save are rejected", async () => {
  delete process.env.SQL_SERVER
  const store = createSqliteStore(":memory:")
  const gateway = createGateway(store)
  const storePhotos = photos()
  await assert.rejects(
    () => saveHandSticker({ image: "", warehouseId: 1, quantity: 1, clientId: 7, gateway, photos: storePhotos }),
    (error) => error.status === 422 && error.message === "אין תמונה",
  )
  await assert.rejects(
    () => saveHandSticker({ image: jpeg, warehouseId: 1, quantity: 0, clientId: 7, gateway, photos: storePhotos }),
    (error) => error.status === 422 && error.message === "לא הוקלדה כמות במלאי",
  )
  gateway.insertHandPhoto = async () => {
    throw new Error("db")
  }
  await assert.rejects(
    () => saveHandSticker({ image: jpeg, warehouseId: 1, quantity: 2, clientId: 7, gateway, photos: storePhotos }),
  )
  assert.deepEqual(storePhotos.removed, ["a.jpg"])
})
