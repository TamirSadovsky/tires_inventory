import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api, readWarehouse, saveWarehouse } from "../api.js"

export function Warehouse() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const back = safeReturn(params.get("return"))
  const [houses, setHouses] = useState(null)
  const [selected, setSelected] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    api
      .warehouses()
      .then((data) => {
        const list = data.warehouses || []
        setHouses(list)
        const saved = readWarehouse()
        const current = saved && list.find((house) => house.id === saved.id)
        const preferred = current || list.find((house) => house.id === 1) || list[0]
        setSelected(preferred ? String(preferred.id) : "")
      })
      .catch((err) => setError(err.message))
  }, [])

  function onSubmit(event) {
    event.preventDefault()
    const house = houses?.find((item) => String(item.id) === selected)
    if (!house) {
      setError("צריך לבחור מחסן")
      return
    }
    saveWarehouse(house)
    navigate(back)
  }

  return (
    <section className="narrow">
      <button type="button" className="text-back" onClick={() => navigate(back)}>חזרה</button>
      <p className="eyebrow">מחסן</p>
      <h1>בחרו מחסן</h1>
      <p className="lead">ברירת המחדל היא המחסן הראשי.</p>
      <form onSubmit={onSubmit} className="stack">
        <label>
          מחסן
          <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!houses?.length}>
            {(houses || []).map((house) => (
              <option key={house.id} value={house.id}>{house.description}</option>
            ))}
          </select>
        </label>
        {houses && !houses.length ? (
          <p className="form-error" role="alert">אין מחסנים לחברה הזו.</p>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary" type="submit" disabled={!selected}>המשך</button>
      </form>
    </section>
  )
}

function safeReturn(value) {
  if (value === "/in" || value === "/out" || value === "/count/scan" || value === "/count/hand") return value
  return "/count/scan"
}
