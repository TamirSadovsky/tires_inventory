import crypto from "node:crypto"
import { executeProcedure, getPool, mssql } from "./sql.js"

export async function loginSql(company, username, password) {
  const sql = mssql()
  const rows = await executeProcedure("dbo.UsersPass", [
    { name: "UserName", type: sql.NVarChar(50), value: username },
  ])
  const user = rows[0]
  if (!user || !passwordMatches(user.Password, password)) {
    const error = new Error("שם משתמש או סיסמה שגויים")
    error.status = 401
    throw error
  }

  const clients = await getPool().then((pool) =>
    pool
      .request()
      .input("name", sql.NVarChar(150), company)
      .query(`
        SELECT ClientID, ClientName
        FROM dbo.ClientsList
        WHERE LTRIM(RTRIM(ClientName)) = LTRIM(RTRIM(@name))
      `),
  )
  const client = clients.recordset.find((row) => Number(row.ClientID) === Number(user.ClientID))
  if (!client) {
    const error = new Error("שם החברה לא תואם למשתמש")
    error.status = 401
    throw error
  }

  return {
    id: user.UserID,
    username: String(user.UserName).trim(),
    displayName: String(user.UserName).trim(),
    clientId: Number(user.ClientID),
    company: String(client.ClientName).trim(),
  }
}

function passwordMatches(stored, given) {
  const left = Buffer.from(String(stored ?? "").trim(), "utf8")
  const right = Buffer.from(String(given ?? ""), "utf8")
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}
