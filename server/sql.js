import sql from "mssql"

export function sqlConfigured() {
  return Boolean(process.env.SQL_SERVER)
}

let poolPromise

export function mssql() {
  return sql
}

export async function getPool() {
  if (!sqlConfigured()) {
    const error = new Error("חיבור ה-SQL לא הוגדר")
    error.status = 503
    throw error
  }
  if (!poolPromise) {
    poolPromise = sql
      .connect({
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE || "CentralDB",
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        port: Number(process.env.SQL_PORT || 1433),
        connectionTimeout: 15000,
        requestTimeout: 30000,
        options: {
          encrypt: process.env.SQL_ENCRYPT !== "false",
          trustServerCertificate: process.env.SQL_TRUST_CERT !== "false",
          enableArithAbort: true,
        },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      })
      .catch((error) => {
        poolPromise = null
        throw error
      })
  }
  return poolPromise
}

export async function executeProcedure(name, inputs) {
  const pool = await getPool()
  const request = pool.request()
  for (const input of inputs) {
    request.input(input.name, input.type, input.value ?? null)
  }
  try {
    const result = await request.execute(name)
    await settleTransaction(pool, "COMMIT")
    return result.recordset || []
  } catch (error) {
    await settleTransaction(pool, "ROLLBACK")
    throw error
  }
}

async function settleTransaction(pool, action) {
  try {
    await pool.request().query(`IF @@TRANCOUNT > 0 ${action} TRANSACTION`)
  } catch (error) {
    if (action === "COMMIT") {
      try {
        await pool.request().query("IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION")
      } catch {
        // The connection is already unusable.
      }
    }
    throw error
  }
}
