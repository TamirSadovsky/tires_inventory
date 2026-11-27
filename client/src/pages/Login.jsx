import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, clearWarehouse } from "../api.js"
import { TireMark } from "../components/TireMark.jsx"

const REMEMBER_KEY = "tb_remember"

export function Login() {
  const navigate = useNavigate()
  const remembered = readRemembered()
  const [company, setCompany] = useState(remembered.company)
  const [username, setUsername] = useState(remembered.username)
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(remembered.on)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState("local")

  useEffect(() => {
    api
      .health()
      .then((data) => setMode(data.mode || "local"))
      .catch(() => setMode("local"))
    api
      .me()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setReady(true))
  }, [navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await api.login(company, username, password)
      clearWarehouse()
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ company: company.trim(), username: username.trim() }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
      navigate("/", { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <p className="boot">טוען…</p>

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <TireMark />
        <p className="eyebrow">קליטת מלאי</p>
        <h1>כניסה</h1>
        <label>
          שם חברה
          <input value={company} onChange={(event) => setCompany(event.target.value)} autoComplete="organization" required />
        </label>
        <label>
          שם משתמש
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" dir="ltr" required />
        </label>
        <label>
          סיסמה
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" dir="ltr" required />
        </label>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          זכור אותי לכניסה הבאה
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? "נכנס…" : "כניסה"}
        </button>
        {mode === "local" ? <p className="hint">משתמש מקומי: admin / admin123</p> : null}
      </form>
    </div>
  )
}

function readRemembered() {
  try {
    const value = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null")
    if (!value) return { company: "", username: "", on: false }
    return { company: value.company || "", username: value.username || "", on: true }
  } catch {
    return { company: "", username: "", on: false }
  }
}
