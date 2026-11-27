import { executeProcedure, mssql, sqlConfigured, withHandCleanupLock } from "./sql.js"

const LOCAL_WAREHOUSES = [
  { id: 1, description: "ראשי" },
  { id: 2, description: "מחסן שני" },
]

export function createGateway(store) {
  return sqlConfigured() ? sqlGateway() : localGateway(store)
}

function localGateway(store) {
  let cleanupLocked = false
  return {
    mode: "local",
    async warehouses() {
      return LOCAL_WAREHOUSES
    },
    async startCount() {},
    async listManufacturers() {
      return store.listLocalManufacturers()
    },
    async findManufacturer(name) {
      return store.findLocalManufacturer(name)
    },
    async addManufacturer(name) {
      return store.addLocalManufacturer(name)
    },
    async insertSfira(row) {
      return store.saveLocalSfira(row)
    },
    async insertInOut(row) {
      return store.saveLocalInOut(row)
    },
    async insertHandPhoto(row) {
      return store.saveLocalHandPhoto(row)
    },
    async listHandPhotosToDelete() {
      return store.listLocalHandPhotos()
        .filter((row) => Number(row.set_on_local_app) === 1)
        .map((row) => ({ clientId: row.client_id, picLink: row.pic_link }))
    },
    async deleteHandPhotosMarked() {
      store.deleteLocalHandPhotosMarked()
    },
    async withHandCleanupLock(work) {
      if (cleanupLocked) return { skipped: "lock" }
      cleanupLocked = true
      try {
        return await work()
      } finally {
        cleanupLocked = false
      }
    },
  }
}

function sqlGateway() {
  const sql = mssql()
  return {
    mode: "sql",
    async warehouses(clientId) {
      const rows = await executeProcedure("dbo.FindWH", [
        { name: "ClientID", type: sql.Int, value: clientId },
      ])
      return rows.map((row) => ({
        id: Number(pick(row, "WearHouseID")),
        description: String(pick(row, "Description") || ""),
      }))
    },
    async startCount(clientId) {
      await executeProcedure("dbo.SetNewSfira", [
        { name: "ClientID", type: sql.Int, value: clientId },
      ])
    },
    async listManufacturers(clientId) {
      const rows = await executeProcedure("dbo.FindMenufacturers", [
        { name: "ClientID", type: sql.Int, value: clientId },
      ])
      return rows
        .map((row) => ({
          id: Number(pick(row, "MenufacturerID")),
          name: String(pick(row, "MenufacturerName") || "").trim(),
        }))
        .filter((item) => Number.isFinite(item.id) && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "he"))
    },
    async findManufacturer(name) {
      const rows = await executeProcedure("dbo.FindMenufacturersFromList", [
        { name: "MenufacturerName", type: sql.NVarChar(30), value: name },
      ])
      return pickManufacturer(rows)
    },
    async addManufacturer(name) {
      const rows = await executeProcedure("dbo.AddMenufacturerToList", [
        { name: "MenufacturerName", type: sql.NVarChar(30), value: name },
      ])
      const created = pickManufacturer(rows)
      if (!created) return null
      return created
    },
    async insertSfira(row) {
      await executeProcedure("dbo.InsertTireSfira", [
        { name: "ClientID", type: sql.Int, value: row.clientId },
        { name: "MenufacturerID", type: sql.Float, value: row.manufacturerId },
        { name: "MenufacturerName", type: sql.NVarChar(30), value: row.manufacturerName },
        { name: "MenufacturerDegem", type: sql.Int, value: 0 },
        { name: "Description", type: sql.NVarChar(250), value: row.description },
        { name: "Wide", type: sql.Float, value: row.wide },
        { name: "Hatach", type: sql.Float, value: row.hatach },
        { name: "Hight", type: sql.Float, value: row.hight },
        { name: "Degem", type: sql.NVarChar(80), value: row.degem },
        { name: "Size", type: sql.NVarChar(100), value: row.size },
        { name: "Speed", type: sql.NVarChar(50), value: row.speed },
        { name: "strength", type: sql.NVarChar(50), value: row.strength },
        { name: "PR", type: sql.NVarChar(50), value: row.pr || "" },
        { name: "OurID", type: sql.NVarChar(50), value: row.ourId },
        { name: "WearHouseID", type: sql.Int, value: row.warehouseId },
        { name: "QuntInML", type: sql.Int, value: row.quantity },
        { name: "Rain", type: sql.NChar(10), value: row.rain || "" },
        { name: "Fuel", type: sql.NChar(10), value: row.fuel || "" },
        { name: "Noise", type: sql.NChar(10), value: row.noise || "" },
      ])
      return { ok: true }
    },
    async insertHandPhoto(row) {
      await executeProcedure("dbo.InsertTireSfiraHand", [
        { name: "ClientID", type: sql.Int, value: row.clientId },
        { name: "PicLink", type: sql.NVarChar(sql.MAX), value: row.picLink },
        { name: "QuntInML", type: sql.Int, value: row.quantity },
        { name: "WearHouseID", type: sql.Int, value: row.warehouseId },
      ])
      return { ok: true }
    },
    async listHandPhotosToDelete() {
      const rows = await executeProcedure("dbo.SetTireSfiraHandToDel", [])
      return rows.map((row) => ({
        clientId: Number(pick(row, "ClientID")),
        picLink: String(pick(row, "PicLink") || ""),
      }))
    },
    async deleteHandPhotosMarked() {
      await executeProcedure("dbo.DelTireSfiraHand", [
        { name: "ClientID", type: sql.Int, value: 0 },
        { name: "PicLink", type: sql.NVarChar(sql.MAX), value: "" },
      ])
    },
    withHandCleanupLock,
    async insertInOut(row) {
      await executeProcedure("dbo.InsertTireInOut", [
        { name: "ClientID", type: sql.Int, value: row.clientId },
        { name: "InOut", type: sql.Int, value: row.inOut },
        { name: "MenufacturerID", type: sql.Float, value: row.manufacturerId },
        { name: "MenufacturerName", type: sql.NVarChar(30), value: row.manufacturerName },
        { name: "MenufacturerDegem", type: sql.Int, value: 0 },
        { name: "Description", type: sql.NVarChar(250), value: row.description },
        { name: "OurID", type: sql.NVarChar(50), value: row.ourId || "" },
        { name: "Qunt", type: sql.Int, value: row.quantity },
        { name: "MLID", type: sql.Int, value: row.mlid },
        { name: "WearHouseID", type: sql.Int, value: row.warehouseId },
      ])
      return { ok: true }
    },
  }
}

function pickManufacturer(rows) {
  if (!rows?.length) return null
  const active = rows.find((row) => {
    const value = pick(row, "Active")
    return value === true || value === 1 || value === "1"
  })
  const row = active || rows[0]
  const id = pick(row, "MenufacturerID")
  if (id == null || id === "") return null
  return { id: Number(id), name: String(pick(row, "MenufacturerName") || "") }
}

function pick(row, key) {
  if (row[key] != null) return row[key]
  const found = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
  return found ? row[found] : null
}
