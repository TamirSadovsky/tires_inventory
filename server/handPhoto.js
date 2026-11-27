import { decodeJpeg } from "./photos.js"

const NO_PHOTO = "אין תמונה"
const NO_QUANTITY = "לא הוקלדה כמות במלאי"

export async function saveHandSticker({ image, warehouseId, quantity, clientId, gateway, photos }) {
  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty < 1) {
    throw reject(NO_QUANTITY)
  }
  const buffer = decodeJpeg(image)
  if (!buffer) throw reject(NO_PHOTO)
  if (gateway.mode === "sql" && photos.mode !== "azure") {
    const error = new Error("אחסון התמונות ב-Azure לא הוגדר")
    error.status = 503
    error.expose = true
    throw error
  }
  const house = await requireWarehouse(warehouseId, clientId, gateway)
  let stored
  try {
    stored = await photos.save(buffer, clientId)
  } catch {
    const error = new Error("שמירת התמונה נכשלה")
    error.status = 502
    error.expose = true
    throw error
  }
  try {
    await gateway.insertHandPhoto({
      clientId,
      picLink: stored.url,
      quantity: qty,
      warehouseId: house.id,
    })
  } catch (error) {
    await photos.remove(stored)
    throw error
  }
  return { picLink: stored.url, quantity: qty, warehouse: house }
}

async function requireWarehouse(warehouseId, clientId, gateway) {
  const houseId = Number(warehouseId)
  if (!Number.isInteger(houseId)) throw reject("צריך לבחור מחסן")
  const houses = await gateway.warehouses(clientId)
  const house = houses.find((item) => item.id === houseId)
  if (!house) throw reject("המחסן לא נמצא")
  return house
}

function reject(message) {
  const error = new Error(message)
  error.status = 422
  return error
}
