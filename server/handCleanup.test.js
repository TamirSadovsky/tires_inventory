import assert from "node:assert/strict"
import test from "node:test"
import { blobNameFromLink } from "./photos.js"
import { cleanupHandPhotos, cleanupTime, nextHandCleanupAt } from "./handCleanup.js"

test("cleanup time defaults to 01:00 and accepts a valid clock", () => {
  assert.equal(cleanupTime(""), "01:00")
  assert.equal(cleanupTime(undefined), "01:00")
  assert.equal(cleanupTime("1:05"), "01:05")
  assert.equal(cleanupTime("23:59"), "23:59")
  assert.equal(cleanupTime("24:00"), "01:00")
  assert.equal(cleanupTime("evening"), "01:00")
})

test("the next cleanup is 01:00 Israel time", () => {
  const before = nextHandCleanupAt(new Date("2026-11-26T22:00:00.000Z"))
  assert.equal(before.toISOString(), "2026-11-26T23:00:00.000Z")
  const after = nextHandCleanupAt(new Date("2026-11-26T23:30:00.000Z"))
  assert.equal(after.toISOString(), "2026-11-27T23:00:00.000Z")
  const summer = nextHandCleanupAt(new Date("2026-07-14T20:00:00.000Z"))
  assert.equal(summer.toISOString(), "2026-07-14T22:00:00.000Z")
  const custom = nextHandCleanupAt(new Date("2026-11-26T22:00:00.000Z"), "02:30")
  assert.equal(custom.toISOString(), "2026-11-27T00:30:00.000Z")
})

test("a blob link keeps only the path inside the container", () => {
  assert.equal(
    blobNameFromLink("https://sfirapictures.blob.core.windows.net/sfira-pictures/1/a.jpg?sv=1", "sfira-pictures"),
    "1/a.jpg",
  )
  assert.equal(blobNameFromLink("/stickers/1/a.jpg", "stickers"), "1/a.jpg")
  assert.equal(blobNameFromLink("https://example.com/other/1/a.jpg", "sfira-pictures"), null)
  assert.equal(blobNameFromLink("/stickers/../secret.jpg", "stickers"), null)
})

test("cleanup deletes every linked file and then all marked rows", async () => {
  const calls = []
  const gateway = fakeGateway([
    { clientId: 1, picLink: "https://sfirapictures.blob.core.windows.net/sfira-pictures/1/a.jpg" },
    { clientId: 1, picLink: "https://sfirapictures.blob.core.windows.net/sfira-pictures/1/b.jpg" },
    { clientId: 1, picLink: "https://files.example/keep.jpg" },
  ])
  const photos = {
    mode: "azure",
    async removeByLink(link) {
      calls.push(link)
      if (link.endsWith("/b.jpg")) return "missing"
      if (link.includes("example")) return "skipped"
      return "deleted"
    },
  }
  const counts = await cleanupHandPhotos({ gateway, photos, log: silent })
  assert.deepEqual(counts, { listed: 3, deleted: 1, missing: 1, skipped: 1, failed: 0 })
  assert.equal(gateway.deleted, 1)
  assert.equal(calls.length, 3)
})

test("a failed blob delete still removes the marked rows", async () => {
  const gateway = fakeGateway([
    { clientId: 1, picLink: "https://sfirapictures.blob.core.windows.net/sfira-pictures/1/a.jpg" },
  ])
  const photos = {
    mode: "azure",
    async removeByLink() {
      throw new Error("storage down")
    },
  }
  const counts = await cleanupHandPhotos({ gateway, photos, log: silent })
  assert.equal(counts.failed, 1)
  assert.equal(gateway.deleted, 1)
})

test("cleanup does not delete rows when another run holds the lock", async () => {
  const gateway = fakeGateway([])
  gateway.withHandCleanupLock = async () => ({ skipped: "lock" })
  const result = await cleanupHandPhotos({
    gateway,
    photos: { mode: "azure", async removeByLink() { return "deleted" } },
    log: silent,
  })
  assert.deepEqual(result, { skipped: "lock" })
  assert.equal(gateway.deleted, 0)
})

test("sql mode without azure storage does not delete the rows", async () => {
  const gateway = fakeGateway([{ clientId: 1, picLink: "https://x/sfira-pictures/1/a.jpg" }])
  gateway.mode = "sql"
  const result = await cleanupHandPhotos({
    gateway,
    photos: { mode: "local", async removeByLink() { return "deleted" } },
    log: silent,
  })
  assert.deepEqual(result, { skipped: "storage" })
  assert.equal(gateway.deleted, 0)
})

function fakeGateway(rows) {
  return {
    mode: "local",
    deleted: 0,
    async listHandPhotosToDelete() {
      return rows
    },
    async deleteHandPhotosMarked() {
      this.deleted += 1
    },
    async withHandCleanupLock(work) {
      return work()
    },
  }
}

const silent = { log() {}, error() {} }
