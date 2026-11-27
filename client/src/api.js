async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || "הבקשה נכשלה")
    error.status = response.status
    error.code = data.code
    error.ourId = data.ourId
    throw error
  }
  return data
}

export const api = {
  health: () => request("/api/health"),
  me: () => request("/api/me"),
  login: (company, username, password) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify({ company, username, password }),
    }),
  logout: () => request("/api/logout", { method: "POST", body: "{}" }),
  warehouses: () => request("/api/warehouses"),
  manufacturers: () => request("/api/manufacturers"),
  addManufacturer: (name) =>
    request("/api/manufacturers", { method: "POST", body: JSON.stringify({ name }) }),
  startCount: (mode) => request("/api/counts", { method: "POST", body: JSON.stringify({ mode }) }),
  preview: (code) => request("/api/preview", { method: "POST", body: JSON.stringify({ code }) }),
  saveCount: (payload) => request("/api/sfira", { method: "POST", body: JSON.stringify(payload) }),
  saveMovement: (payload) => request("/api/inout", { method: "POST", body: JSON.stringify(payload) }),
  saveHandSticker: (payload) => request("/api/hand-sticker", { method: "POST", body: JSON.stringify(payload) }),
}

export const EXAMPLE_EPREL =
  "https://eprel.ec.europa.eu/screen/product/tyres/1803060?navigatingFrom=qr"

const WAREHOUSE_KEY = "tb_warehouse"

export function saveWarehouse(warehouse) {
  sessionStorage.setItem(WAREHOUSE_KEY, JSON.stringify(warehouse))
}

export function readWarehouse() {
  try {
    return JSON.parse(sessionStorage.getItem(WAREHOUSE_KEY) || "null")
  } catch {
    return null
  }
}

export function clearWarehouse() {
  sessionStorage.removeItem(WAREHOUSE_KEY)
}
