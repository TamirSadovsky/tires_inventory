const EPREL_ORIGIN = "https://eprel.ec.europa.eu"

export function resolveScan(raw) {
  const text = String(raw || "").trim()
  if (!text || text.length > 2000) {
    return fail("unknown", "לא זיהיתי קוד צמיג.")
  }

  const fromUrl = text.match(
    /eprel\.ec\.europa\.eu\/(?:screen\/product\/tyres|qr|api\/products\/tyres)\/(\d{4,11})/i,
  )
  if (fromUrl) return eprel(fromUrl[1])

  if (/^\d{4,11}$/.test(text)) return eprel(text)

  if (/^\d{12,14}$/.test(text)) {
    return {
      kind: "gtin",
      gtin: text,
      registrationNumber: null,
      openUrl: null,
      message:
        "זה ברקוד מוצר (EAN). הוא לא פותח את דף התווית. סורקים את קוד ה-QR שעל תווית האנרגיה, או מדביקים את קישור EPREL.",
    }
  }

  try {
    const url = new URL(text)
    if (url.protocol === "http:" || url.protocol === "https:") {
      return fail("foreign-url", "הקישור אינו דף צמיג ב-EPREL.")
    }
  } catch {
    // not a URL
  }

  return fail(
    "unknown",
    "לא זיהיתי קוד צמיג. אפשר להדביק קישור EPREL או מספר רישום.",
  )
}

function eprel(registrationNumber) {
  return {
    kind: "eprel",
    registrationNumber,
    openUrl: `${EPREL_ORIGIN}/screen/product/tyres/${registrationNumber}?navigatingFrom=qr`,
    apiUrl: `${EPREL_ORIGIN}/api/products/tyres/${registrationNumber}`,
    message: "",
  }
}

function fail(kind, message) {
  return { kind, registrationNumber: null, openUrl: null, message }
}

export async function fetchTyre(registrationNumber) {
  if (!/^\d{4,11}$/.test(String(registrationNumber || ""))) {
    throw new Error("מספר רישום לא תקין")
  }
  const url = `${EPREL_ORIGIN}/api/products/tyres/${registrationNumber}`
  let response
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/json",
        "User-Agent": "TireBarcode/1.0",
      },
    })
  } catch {
    throw new Error("לא הצלחתי להתחבר ל-EPREL")
  }
  if (response.status === 404) throw new Error("הצמיג לא נמצא ב-EPREL")
  if (!response.ok) throw new Error(`EPREL החזיר שגיאה ${response.status}`)
  const data = await response.json()
  if (!data || typeof data !== "object" || !data.sizeDesignation) {
    throw new Error("התשובה אינה רשומת צמיג")
  }
  return data
}
