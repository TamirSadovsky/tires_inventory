import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api.js"

export function CountStart() {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")

  async function choose(mode) {
    setBusy(mode)
    setError("")
    try {
      await api.startCount(mode)
      navigate("/count/scan")
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="narrow">
      <button type="button" className="text-back" onClick={() => navigate("/")}>חזרה לבית</button>
      <p className="eyebrow">ספירת מלאי</p>
      <h1>ספירת מלאי</h1>
      <div className="choice-grid">
        <button type="button" className="button primary big" disabled={Boolean(busy)} onClick={() => choose("new")}>
          {busy === "new" ? "פותח…" : "ספירה חדשה"}
        </button>
        <button type="button" className="button ghost big" disabled={Boolean(busy)} onClick={() => choose("continue")}>
          {busy === "continue" ? "ממשיך…" : "המשך ספירה"}
        </button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  )
}
