import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { BlobServiceClient } from "@azure/storage-blob"

const MAX_BYTES = 8 * 1024 * 1024

export function decodeJpeg(image) {
  const text = String(image || "")
  const base64 = text.includes(",") ? text.slice(text.indexOf(",") + 1) : text
  if (!base64.trim()) return null
  let buffer
  try {
    buffer = Buffer.from(base64, "base64")
  } catch {
    return null
  }
  if (buffer.length < 4 || buffer.length > MAX_BYTES) return null
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) return null
  return buffer
}

export function createPhotoStore(dir) {
  if (process.env.AZURE_STORAGE_CONNECTION_STRING) return createAzurePhotoStore()
  return createLocalPhotoStore(dir)
}

function createAzurePhotoStore() {
  const service = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
  const containerName = process.env.AZURE_STORAGE_CONTAINER || "sfira-pictures"
  return {
    mode: "azure",
    async save(buffer, clientId) {
      const container = service.getContainerClient(containerName)
      await container.createIfNotExists()
      const name = `${clientId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`
      const blob = container.getBlockBlobClient(name)
      await blob.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: "image/jpeg" },
      })
      return { url: blob.url, name }
    },
    async remove(stored) {
      if (!stored?.name) return
      const container = service.getContainerClient(containerName)
      await container.deleteBlob(stored.name).catch(() => {})
    },
  }
}

function createLocalPhotoStore(dir) {
  return {
    mode: "local",
    async save(buffer, clientId) {
      const folder = path.join(dir, String(clientId))
      fs.mkdirSync(folder, { recursive: true })
      const name = `${clientId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.jpg`
      fs.writeFileSync(path.join(dir, name), buffer)
      return { url: `/stickers/${name}`, name }
    },
    async remove(stored) {
      if (!stored?.name) return
      fs.rmSync(path.join(dir, stored.name), { force: true })
    },
  }
}
