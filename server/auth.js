import crypto from "node:crypto"
import bcrypt from "bcryptjs"

const COOKIE = "tb_session"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function createAuth(store, secret) {
  return {
    async ensureAdmin(username, password) {
      if (store.countUsers() > 0) return
      const passwordHash = await bcrypt.hash(password, 10)
      store.createUser({
        username,
        passwordHash,
        displayName: "מפעיל",
      })
    },

    async login(username, password) {
      const user = store.findUser(String(username || "").trim())
      if (!user) return null
      const match = await bcrypt.compare(String(password || ""), user.passwordHash)
      if (!match) return null
      return publicUser(user)
    },

    sign(user) {
      const body = Buffer.from(
        JSON.stringify({
          uid: user.id,
          username: user.username,
          displayName: user.displayName || "",
          clientId: user.clientId ?? null,
          company: user.company || "",
          exp: Date.now() + WEEK_MS,
        }),
      ).toString("base64url")
      const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url")
      return `${body}.${sig}`
    },

    read(token) {
      if (!token || !token.includes(".")) return null
      const [body, sig] = token.split(".")
      const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url")
      const left = Buffer.from(sig)
      const right = Buffer.from(expected)
      if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null
      try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString())
        if (!payload?.uid || payload.exp < Date.now()) return null
        return {
          id: payload.uid,
          username: payload.username,
          displayName: payload.displayName || payload.username,
          clientId: payload.clientId ?? null,
          company: payload.company || "",
        }
      } catch {
        return null
      }
    },

    cookieName: COOKIE,

    requireUser(req, res, next) {
      const user = this.read(req.cookies?.[COOKIE])
      if (!user) {
        res.status(401).json({ error: "נדרשת כניסה" })
        return
      }
      req.user = user
      next()
    },
  }
}

function publicUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName }
}
