import { mlidFromOurId, tireRecordFromManual } from "../shared/tireFields.js"
import { fetchTyre, resolveScan } from "./eprel.js"
import { resolveManufacturer } from "./manufacturer.js"
import { tireRecordFromProduct } from "./size.js"

const MISSING = "לא נסרק צמיג או לא הוקלדה כמות במלאי לא ניתן לשמור"

export async function previewTire(code) {
  const resolved = resolveScan(code)
  if (!resolved.registrationNumber) {
    const error = new Error(resolved.message)
    error.status = 422
    throw error
  }
  let product
  try {
    product = await fetchTyre(resolved.registrationNumber)
  } catch (error) {
    if (error.message === "הצמיג לא נמצא ב-EPREL" || error.message === "התשובה אינה רשומת צמיג") {
      error.status = 422
      error.code = "not-found"
      error.ourId = resolved.registrationNumber
    }
    throw error
  }
  const tire = tireRecordFromProduct(product)
  if (!tire.ourId) tire.ourId = resolved.registrationNumber
  return {
    openUrl: resolved.openUrl,
    tire,
  }
}

export async function saveInventory({ kind, code, manual, warehouseId, quantity, clientId, gateway }) {
  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty < 1 || (!String(code || "").trim() && !manual)) {
    const error = new Error(MISSING)
    error.status = 422
    throw error
  }
  const house = await requireWarehouse(warehouseId, clientId, gateway)
  const tire = manual
    ? await manualTire(manual, clientId, gateway)
    : await scannedTire(code, gateway)
  if (kind === "in" || kind === "out") {
    await gateway.insertInOut({
      clientId,
      inOut: kind === "in" ? 1 : 2,
      manufacturerId: tire.manufacturerId,
      manufacturerName: tire.manufacturerName,
      manufacturerDegem: 0,
      description: tire.description,
      ourId: tire.ourId,
      quantity: qty,
      mlid: mlidFromOurId(tire.ourId),
      warehouseId: house.id,
    })
  } else {
    await gateway.insertSfira(sfiraRow(tire, clientId, house.id, qty))
  }
  return { tire, warehouse: house, quantity: qty }
}

async function scannedTire(code, gateway) {
  const preview = await previewTire(code)
  const manufacturer = await resolveManufacturer(preview.tire.manufacturerName, gateway)
  return {
    ...preview.tire,
    manufacturerId: manufacturer.id,
    manufacturerName: clip(manufacturer.name || preview.tire.manufacturerName, 30),
  }
}

async function manualTire(manual, clientId, gateway) {
  const size = String(manual?.size || "").trim()
  const loadCode = String(manual?.loadCode || "").trim()
  const manufacturer = await chosenManufacturer(manual, clientId, gateway)
  if (!size || !loadCode) {
    const error = new Error(MISSING)
    error.status = 422
    throw error
  }
  const record = tireRecordFromManual(manual || {})
  return {
    ...record,
    manufacturerId: manufacturer.id,
    manufacturerName: clip(manufacturer.name, 30),
  }
}

async function chosenManufacturer(manual, clientId, gateway) {
  const name = clip(manual?.manufacturerName, 30)
  const rawId = manual?.manufacturerId
  const id = rawId === "" || rawId == null || !Number.isFinite(Number(rawId)) ? null : Number(rawId)
  const listed = await gateway.listManufacturers(clientId)
  const fromClient = id == null ? null : listed.find((item) => item.id === id)
  if (fromClient) return fromClient
  if (name) {
    const found = await gateway.findManufacturer(name)
    if (found?.id != null && (id == null || found.id === id)) {
      return { id: Number(found.id), name: found.name || name }
    }
  }
  const error = new Error(name ? "צריך לבחור יצרן מהרשימה או להוסיף אותו" : MISSING)
  error.status = 422
  throw error
}

async function requireWarehouse(warehouseId, clientId, gateway) {
  const houseId = Number(warehouseId)
  if (!Number.isInteger(houseId)) {
    const error = new Error("צריך לבחור מחסן")
    error.status = 422
    throw error
  }
  const houses = await gateway.warehouses(clientId)
  const house = houses.find((item) => item.id === houseId)
  if (!house) {
    const error = new Error("המחסן לא נמצא")
    error.status = 422
    throw error
  }
  return house
}

function sfiraRow(tire, clientId, warehouseId, quantity) {
  return {
    clientId,
    manufacturerId: tire.manufacturerId,
    manufacturerName: tire.manufacturerName,
    manufacturerDegem: 0,
    description: tire.description,
    wide: tire.wide,
    hatach: tire.hatach,
    hight: tire.hight,
    degem: tire.degem,
    size: tire.size,
    speed: tire.speed,
    strength: tire.strength,
    pr: tire.pr,
    ourId: tire.ourId,
    warehouseId,
    quantity,
    rain: tire.rain,
    fuel: tire.fuel,
    noise: tire.noise,
  }
}

function clip(value, length) {
  return String(value || "").trim().slice(0, length)
}
