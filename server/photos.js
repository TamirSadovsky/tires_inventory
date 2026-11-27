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

export function blobNameFromLink(link, containerName) {
  const text = String(link || "").trim()
  const container = String(containerName || "").trim()
  if (!text || !container) return null
  let pathname = text
  try {
    pathname = new URL(text).pathname
  } catch {
    if (!text.startsWith("/")) return null
  }
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const parts = decoded.split("/").filter(Boolean)
  if (parts.length < 2 || parts.some((part) => part === "." || part === "..")) return null
  if (parts[0].toLowerCase() !== container.toLowerCase()) return null
  return parts.slice(1).join("/")
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
    async removeByLink(link) {
      const name = blobNameFromLink(link, containerName)
      if (!name) return "skipped"
      try {
        const container = service.getContainerClient(containerName)
        const result = await container.getBlockBlobClient(name).deleteIfExists()
        return result.succeeded ? "deleted" : "missing"
      } catch {
        return "failed"
      }
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
    async removeByLink(link) {
      const name = blobNameFromLink(link, "stickers")
      if (!name) return "skipped"
      const file = path.resolve(dir, name)
      const root = path.resolve(dir)
      if (file !== root && !file.startsWith(root + path.sep)) return "skipped"
      if (!fs.existsSync(file)) return "missing"
      fs.rmSync(file, { force: true })
      return "deleted"
    },
  }
}
