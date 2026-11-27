import { useEffect, useState } from "react"
import { Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { api, clearWarehouse } from "./api.js"
import { TireMark } from "./components/TireMark.jsx"
import { CountStart } from "./pages/CountStart.jsx"
import { Home } from "./pages/Home.jsx"
import { Login } from "./pages/Login.jsx"
import { HandSticker } from "./pages/HandSticker.jsx"
import { Scan } from "./pages/Scan.jsx"
import { Warehouse } from "./pages/Warehouse.jsx"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/count" element={<RequireAuth><CountStart /></RequireAuth>} />
      <Route path="/count/warehouse" element={<RequireAuth><Warehouse /></RequireAuth>} />
      <Route path="/count/scan" element={<RequireAuth><Scan mode="count" /></RequireAuth>} />
      <Route path="/count/hand" element={<RequireAuth><HandSticker /></RequireAuth>} />
      <Route path="/in" element={<RequireAuth><Scan mode="in" /></RequireAuth>} />
      <Route path="/out" element={<RequireAuth><Scan mode="out" /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireAuth({ children }) {
  const [state, setState] = useState(undefined)

  useEffect(() => {
    let active = true
    api
      .me()
      .then((data) => {
        if (active) setState(data)
      })
      .catch(() => {
        if (active) setState(null)
      })
    return () => {
      active = false
    }
  }, [])

  if (state === undefined) return <p className="boot">טוען…</p>
  if (!state) return <Navigate to="/login" replace />
  return <Shell user={state.user} mode={state.mode}>{children}</Shell>
}

function Shell({ user, mode, children }) {
  const navigate = useNavigate()

  async function logout() {
    await api.logout()
    clearWarehouse()
    navigate("/login", { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => navigate("/")}>
          <TireMark />
          <span>
            <strong>קליטת מלאי</strong>
            <small>{user.company}</small>
          </span>
        </button>
        <div className="who">
          <span className="who-name">{user.displayName}</span>
          <button type="button" onClick={logout}>יציאה</button>
        </div>
      </header>
      {mode === "local" ? (
        <p className="local-banner">מצב מקומי. השמירה תעבור לשרת ה-SQL ברגע שהחיבור יופעל.</p>
      ) : null}
      <main>{children}</main>
    </div>
  )
}
