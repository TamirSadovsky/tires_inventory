export function normalizeManufacturerName(name) {
  return String(name || "").trim().slice(0, 30)
}

export async function resolveManufacturer(name, gateway) {
  const normalized = normalizeManufacturerName(name)
  if (!normalized) {
    const error = new Error("לא נמצא שם יצרן בתווית")
    error.status = 422
    throw error
  }
  const found = await gateway.findManufacturer(normalized)
  if (found?.id != null && !Number.isNaN(Number(found.id))) {
    return { id: Number(found.id), name: found.name || normalized }
  }
  const created = await gateway.addManufacturer(normalized)
  if (created?.id == null || Number.isNaN(Number(created.id))) {
    const error = new Error("לא התקבל קוד יצרן חדש")
    error.status = 502
    throw error
  }
  return { id: Number(created.id), name: created.name || normalized }
}
