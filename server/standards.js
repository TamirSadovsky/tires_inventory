export const LOAD_KG = {
  60: 250, 61: 257, 62: 265, 63: 272, 64: 280, 65: 290, 66: 300, 67: 307, 68: 315, 69: 325,
  70: 335, 71: 345, 72: 355, 73: 365, 74: 375, 75: 387, 76: 400, 77: 412, 78: 425, 79: 437,
  80: 450, 81: 462, 82: 475, 83: 487, 84: 500, 85: 515, 86: 530, 87: 545, 88: 560, 89: 580,
  90: 600, 91: 615, 92: 630, 93: 650, 94: 670, 95: 690, 96: 710, 97: 730, 98: 750, 99: 775,
  100: 800, 101: 825, 102: 850, 103: 875, 104: 900, 105: 925, 106: 950, 107: 975, 108: 1000,
  109: 1030, 110: 1060, 111: 1090, 112: 1120, 113: 1150, 114: 1180, 115: 1215, 116: 1250,
  117: 1285, 118: 1320, 119: 1360, 120: 1400, 121: 1450, 122: 1500, 123: 1550, 124: 1600,
  125: 1650, 126: 1700, 127: 1750, 128: 1800, 129: 1850, 130: 1900,
}

export const SPEED_KMH = {
  A1: 5, A2: 10, A3: 15, A4: 20, A5: 25, A6: 30, A7: 35, A8: 40,
  B: 50, C: 60, D: 65, E: 70, F: 80, G: 90, J: 100, K: 110,
  L: 120, M: 130, N: 140, P: 150, Q: 160, R: 170, S: 180, T: 190,
  U: 200, H: 210, V: 240, W: 270, Y: 300,
}

export const TYRE_CLASS_HE = {
  C1: "מחלקה C1, צמיג לרכב נוסעים.",
  C2: "מחלקה C2, צמיג לרכב מסחרי קל.",
  C3: "מחלקה C3, צמיג למשאית או לאוטובוס.",
}

export const LOAD_VERSION_HE = {
  SL: "עומס רגיל",
  XL: "עומס מוגבר",
  RF: "מחוזק",
  REINFORCED: "מחוזק",
}

const FUEL_TEXT = {
  A: "הדרגה החסכונית ביותר בתווית.",
  B: "חיסכון טוב בדלק.",
  C: "חיסכון בינוני בדלק.",
  D: "חיסכון נמוך בדלק.",
  E: "הדרגה הפחות חסכונית בתווית.",
}

const WET_TEXT = {
  A: "האחיזה הגבוהה ביותר על כביש רטוב.",
  B: "אחיזה טובה על כביש רטוב.",
  C: "אחיזה בינונית על כביש רטוב.",
  D: "אחיזה נמוכה על כביש רטוב.",
  E: "האחיזה הנמוכה ביותר בתווית.",
}

const NOISE_TEXT = {
  A: "דרגת הרעש השקטה יותר.",
  B: "דרגת רעש בינונית.",
  C: "דרגת הרעש הגבוהה יותר.",
}

export function gradeRank(letter) {
  const order = { A: 5, B: 4, C: 3, D: 2, E: 1 }
  return order[String(letter || "").toUpperCase()] ?? null
}

export function fuelInfo(letter) {
  const grade = String(letter || "").toUpperCase()
  return { grade, text: FUEL_TEXT[grade] || "" }
}

export function wetInfo(letter) {
  const grade = String(letter || "").toUpperCase()
  return { grade, text: WET_TEXT[grade] || "" }
}

export function noiseInfo(db, letter) {
  const grade = String(letter || "").toUpperCase()
  return { db: db ?? null, grade, text: NOISE_TEXT[grade] || "" }
}

export function fullProductionYear(year) {
  if (year == null || year === "") return null
  const value = Number(year)
  if (!Number.isFinite(value)) return null
  return value < 100 ? 2000 + value : value
}
