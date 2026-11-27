import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

export function createSqliteStore(file) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }
  const db = new Database(file)
  db.pragma("journal_mode = WAL")
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tires (
      id INTEGER PRIMARY KEY,
      eprel_registration_number TEXT NOT NULL UNIQUE,
      source_url TEXT NOT NULL,
      brand TEXT,
      commercial_name TEXT,
      model_identifier TEXT,
      gtin TEXT,
      tyre_class TEXT,
      size_designation TEXT,
      tyre_designation TEXT,
      section_width INTEGER,
      aspect_ratio INTEGER,
      rim_diameter INTEGER,
      load_index INTEGER,
      load_kg INTEGER,
      speed_symbol TEXT,
      speed_kmh INTEGER,
      load_version TEXT,
      fuel_class TEXT,
      wet_grip_class TEXT,
      noise_db INTEGER,
      noise_class TEXT,
      snow_tyre INTEGER NOT NULL DEFAULT 0,
      ice_tyre INTEGER NOT NULL DEFAULT 0,
      production_week INTEGER,
      production_year INTEGER,
      organisation_name TEXT,
      website TEXT,
      status TEXT,
      summary_he TEXT,
      raw_json TEXT NOT NULL,
      scanned_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY,
      raw_code TEXT NOT NULL,
      code_type TEXT NOT NULL,
      resolved_url TEXT,
      eprel_number TEXT,
      tire_id INTEGER,
      user_id INTEGER,
      status TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tires_size ON tires(size_designation);

    CREATE TABLE IF NOT EXISTS local_manufacturers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS local_sfira (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      manufacturer_id REAL,
      manufacturer_name TEXT,
      manufacturer_degem INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      wide REAL,
      hatach REAL,
      hight REAL,
      degem TEXT,
      size TEXT,
      speed TEXT,
      strength TEXT,
      pr TEXT,
      our_id TEXT,
      warehouse_id INTEGER,
      quantity INTEGER NOT NULL,
      rain TEXT,
      fuel TEXT,
      noise TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_hand_photos (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      pic_link TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      set_on_local_app INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_inout (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL,
      in_out INTEGER NOT NULL,
      manufacturer_id REAL,
      manufacturer_name TEXT,
      manufacturer_degem INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      our_id TEXT,
      quantity INTEGER NOT NULL,
      mlid INTEGER NOT NULL,
      warehouse_id INTEGER,
      created_at TEXT NOT NULL
    );
  `)

  const findUser = db.prepare("SELECT * FROM users WHERE username = ?")
  const countUsers = db.prepare("SELECT COUNT(*) AS count FROM users")
  const insertUser = db.prepare(
    "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)",
  )
  const upsertTire = db.prepare(`
    INSERT INTO tires (
      eprel_registration_number, source_url, brand, commercial_name, model_identifier, gtin,
      tyre_class, size_designation, tyre_designation, section_width, aspect_ratio, rim_diameter,
      load_index, load_kg, speed_symbol, speed_kmh, load_version, fuel_class, wet_grip_class,
      noise_db, noise_class, snow_tyre, ice_tyre, production_week, production_year,
      organisation_name, website, status, summary_he, raw_json, scanned_by, created_at, updated_at
    ) VALUES (
      @eprelRegistrationNumber, @sourceUrl, @brand, @commercialName, @modelIdentifier, @gtin,
      @tyreClass, @sizeDesignation, @tyreDesignation, @sectionWidth, @aspectRatio, @rimDiameter,
      @loadIndex, @loadKg, @speedSymbol, @speedKmh, @loadVersion, @fuelClass, @wetGripClass,
      @noiseDb, @noiseClass, @snowTyre, @iceTyre, @productionWeek, @productionYear,
      @organisationName, @website, @status, @summaryHe, @rawJson, @scannedBy, @createdAt, @updatedAt
    )
    ON CONFLICT(eprel_registration_number) DO UPDATE SET
      source_url = excluded.source_url,
      brand = excluded.brand,
      commercial_name = excluded.commercial_name,
      model_identifier = excluded.model_identifier,
      gtin = excluded.gtin,
      tyre_class = excluded.tyre_class,
      size_designation = excluded.size_designation,
      tyre_designation = excluded.tyre_designation,
      section_width = excluded.section_width,
      aspect_ratio = excluded.aspect_ratio,
      rim_diameter = excluded.rim_diameter,
      load_index = excluded.load_index,
      load_kg = excluded.load_kg,
      speed_symbol = excluded.speed_symbol,
      speed_kmh = excluded.speed_kmh,
      load_version = excluded.load_version,
      fuel_class = excluded.fuel_class,
      wet_grip_class = excluded.wet_grip_class,
      noise_db = excluded.noise_db,
      noise_class = excluded.noise_class,
      snow_tyre = excluded.snow_tyre,
      ice_tyre = excluded.ice_tyre,
      production_week = excluded.production_week,
      production_year = excluded.production_year,
      organisation_name = excluded.organisation_name,
      website = excluded.website,
      status = excluded.status,
      summary_he = excluded.summary_he,
      raw_json = excluded.raw_json,
      scanned_by = excluded.scanned_by,
      updated_at = excluded.updated_at
  `)
  const tireByEprel = db.prepare(`${tireSelect()} WHERE tires.eprel_registration_number = ?`)
  const tireById = db.prepare(`${tireSelect()} WHERE tires.id = ?`)
  const listTires = db.prepare(`${tireSelect()} ORDER BY tires.updated_at DESC`)
  const listBySize = db.prepare(
    `${tireSelect()} WHERE tires.size_designation = ? AND tires.eprel_registration_number != ?`,
  )
  const insertScan = db.prepare(`
    INSERT INTO scans (raw_code, code_type, resolved_url, eprel_number, tire_id, user_id, status, message, created_at)
    VALUES (@rawCode, @codeType, @resolvedUrl, @eprelNumber, @tireId, @userId, @status, @message, @createdAt)
  `)
  const findMaker = db.prepare("SELECT id, name FROM local_manufacturers WHERE name = ?")
  const listMakers = db.prepare("SELECT id, name FROM local_manufacturers ORDER BY name")
  const maxMaker = db.prepare("SELECT COALESCE(MAX(id), 0) AS maxId FROM local_manufacturers")
  const insertMaker = db.prepare("INSERT INTO local_manufacturers (id, name) VALUES (?, ?)")
  const insertInOut = db.prepare(`
    INSERT INTO local_inout (
      client_id, in_out, manufacturer_id, manufacturer_name, manufacturer_degem,
      description, our_id, quantity, mlid, warehouse_id, created_at
    ) VALUES (
      @clientId, @inOut, @manufacturerId, @manufacturerName, @manufacturerDegem,
      @description, @ourId, @quantity, @mlid, @warehouseId, @createdAt
    )
  `)
  const insertHandPhoto = db.prepare(`
    INSERT INTO local_hand_photos (
      client_id, pic_link, quantity, warehouse_id, set_on_local_app, created_at
    ) VALUES (
      @clientId, @picLink, @quantity, @warehouseId, 0, @createdAt
    )
  `)
  const listHandPhotos = db.prepare("SELECT * FROM local_hand_photos ORDER BY id")
  const deleteMarkedHandPhotos = db.prepare(
    "DELETE FROM local_hand_photos WHERE set_on_local_app = 1",
  )
  const insertSfira = db.prepare(`
    INSERT INTO local_sfira (
      client_id, manufacturer_id, manufacturer_name, manufacturer_degem, description,
      wide, hatach, hight, degem, size, speed, strength, pr, our_id, warehouse_id,
      quantity, rain, fuel, noise, created_at
    ) VALUES (
      @clientId, @manufacturerId, @manufacturerName, @manufacturerDegem, @description,
      @wide, @hatach, @hight, @degem, @size, @speed, @strength, @pr, @ourId, @warehouseId,
      @quantity, @rain, @fuel, @noise, @createdAt
    )
  `)

  return {
    provider: "sqlite",
    countUsers() {
      return countUsers.get().count
    },
    findUser(username) {
      const row = findUser.get(username)
      if (!row) return null
      return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        displayName: row.display_name,
      }
    },
    createUser({ username, passwordHash, displayName }) {
      const result = insertUser.run(username, passwordHash, displayName, now())
      return this.findUser(username) || { id: Number(result.lastInsertRowid), username, displayName }
    },
    saveTire(tire) {
      const timestamp = now()
      const record = {
        ...tire,
        snowTyre: tire.snowTyre ? 1 : 0,
        iceTyre: tire.iceTyre ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      for (const key of Object.keys(record)) {
        if (record[key] === undefined) record[key] = null
      }
      upsertTire.run(record)
      return rowToTire(tireByEprel.get(tire.eprelRegistrationNumber))
    },
    listTires() {
      return listTires.all().map(rowToTire)
    },
    getTire(id) {
      return rowToTire(tireById.get(id))
    },
    listBySize(sizeDesignation, exceptEprel) {
      if (!sizeDesignation) return []
      return listBySize.all(sizeDesignation, exceptEprel || "").map(rowToTire)
    },
    insertScan(scan) {
      insertScan.run({ ...scan, createdAt: now() })
    },
    listLocalManufacturers() {
      return listMakers.all()
    },
    findLocalManufacturer(name) {
      const row = findMaker.get(name)
      return row ? { id: row.id, name: row.name } : null
    },
    addLocalManufacturer(name) {
      const existing = findMaker.get(name)
      if (existing) return { id: existing.id, name: existing.name }
      const id = maxMaker.get().maxId + 1
      insertMaker.run(id, name)
      return { id, name }
    },
    saveLocalHandPhoto(row) {
      const result = insertHandPhoto.run({ ...row, createdAt: now() })
      return { id: Number(result.lastInsertRowid) }
    },
    listLocalHandPhotos() {
      return listHandPhotos.all()
    },
    deleteLocalHandPhotosMarked() {
      deleteMarkedHandPhotos.run()
    },
    saveLocalSfira(row) {
      const result = insertSfira.run({ ...row, createdAt: now() })
      return { id: Number(result.lastInsertRowid) }
    },
    saveLocalInOut(row) {
      const result = insertInOut.run({
        manufacturerDegem: 0,
        ourId: "",
        mlid: 0,
        ...row,
        createdAt: now(),
      })
      return { id: Number(result.lastInsertRowid) }
    },
  }
}

function tireSelect() {
  return `
    SELECT tires.*, users.display_name AS scanned_by_name
    FROM tires
    LEFT JOIN users ON users.id = tires.scanned_by
  `
}

function rowToTire(row) {
  if (!row) return null
  return {
    id: row.id,
    eprelRegistrationNumber: row.eprel_registration_number,
    sourceUrl: row.source_url,
    brand: row.brand || "",
    commercialName: row.commercial_name || "",
    modelIdentifier: row.model_identifier || "",
    gtin: row.gtin || "",
    tyreClass: row.tyre_class || "",
    sizeDesignation: row.size_designation || "",
    tyreDesignation: row.tyre_designation || "",
    sectionWidth: row.section_width,
    aspectRatio: row.aspect_ratio,
    rimDiameter: row.rim_diameter,
    loadIndex: row.load_index,
    loadKg: row.load_kg,
    speedSymbol: row.speed_symbol || "",
    speedKmh: row.speed_kmh,
    loadVersion: row.load_version || "",
    fuelClass: row.fuel_class || "",
    wetGripClass: row.wet_grip_class || "",
    noiseDb: row.noise_db,
    noiseClass: row.noise_class || "",
    snowTyre: Boolean(row.snow_tyre),
    iceTyre: Boolean(row.ice_tyre),
    productionWeek: row.production_week,
    productionYear: row.production_year,
    organisationName: row.organisation_name || "",
    website: row.website || "",
    status: row.status || "",
    summaryHe: row.summary_he || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scannedByName: row.scanned_by_name || "",
  }
}

function now() {
  return new Date().toISOString()
}
