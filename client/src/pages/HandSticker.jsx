import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, readWarehouse, saveWarehouse } from "../api.js"

const BACK = "/count/scan"

export function HandSticker() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [warehouse, setWarehouse] = useState(() => readWarehouse())
  const [photo, setPhoto] = useState("")
  const [quantity, setQuantity] = useState("")
  const [cameraError, setCameraError] = useState("")
  const [error, setError] = useState("")
  const [missingPhoto, setMissingPhoto] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    let stopped = false
    openCamera(video)
      .then((stream) => {
        if (stopped) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
      })
      .catch((err) => {
        if (!stopped) setCameraError(err?.message || "המצלמה לא נפתחה")
      })
    return () => {
      stopped = true
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    api
      .warehouses()
      .then((data) => {
        if (!active) return
        const list = data.warehouses || []
        const saved = readWarehouse()
        const current = saved && list.find((house) => house.id === saved.id)
        const preferred = current || list.find((house) => house.id === 1) || list[0] || null
        if (preferred) {
          saveWarehouse(preferred)
          setWarehouse(preferred)
        } else {
          setWarehouse(null)
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  function takePhoto() {
    const frame = captureFrame(videoRef.current)
    if (!frame) {
      setCameraError("המצלמה עדיין לא מוכנה")
      return
    }
    setPhoto(frame)
    setMissingPhoto(false)
    setCameraError("")
  }

  async function onConfirm(event) {
    event.preventDefault()
    if (!photo) {
      setMissingPhoto(true)
      setError("")
      return
    }
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < 1) {
      setError("לא הוקלדה כמות במלאי")
      setMissingPhoto(false)
      return
    }
    if (!warehouse) {
      setError("צריך לבחור מחסן")
      setMissingPhoto(false)
      return
    }
    setBusy(true)
    setError("")
    try {
      await api.saveHandSticker({
        image: photo,
        warehouseId: warehouse.id,
        quantity: qty,
      })
      navigate(BACK)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="scan-page has-save">
      <div className="scan-head">
        <button type="button" className="text-back" onClick={() => navigate(BACK)}>חזרה</button>
        <h1>צילום מדבקה</h1>
        <button
          type="button"
          className="warehouse-field"
          onClick={() => navigate(`/count/warehouse?return=${encodeURIComponent("/count/hand")}`)}
        >
          <small>מחסן</small>
          <strong>{warehouse?.description || "בחירה"}</strong>
        </button>
      </div>
      <div className="panel">
        <div className="viewfinder">
          <video ref={videoRef} className="scan-video" autoPlay muted playsInline />
          {photo ? <img className="shot" src={photo} alt="המדבקה שצולמה" /> : null}
          {cameraError && !photo ? <div className="viewfinder-idle">{cameraError}</div> : null}
        </div>
        <button type="button" className="button primary big" onClick={takePhoto} disabled={busy}>
          צלם
        </button>
      </div>
      <form className="save-dock" onSubmit={onConfirm}>
        <div className="qty-block">
          <span>כמות במלאי</span>
          <div className="qty" dir="ltr">
            <button type="button" onClick={() => changeQuantity(quantity, -1, setQuantity)} aria-label="הפחת כמות">−</button>
            <input
              inputMode="numeric"
              enterKeyHint="done"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ""))}
              aria-label="כמות במלאי"
            />
            <button type="button" onClick={() => changeQuantity(quantity, 1, setQuantity)} aria-label="הוסף כמות">+</button>
          </div>
        </div>
        {missingPhoto ? (
          <div className="missing-photo" role="alert">
            <strong>אין תמונה</strong>
            <p>האם לחזור לסריקה?</p>
            <div className="row-actions">
              <button type="button" className="button primary" onClick={() => navigate(BACK)}>חזרה לסריקה</button>
              <button type="button" className="button ghost" onClick={() => setMissingPhoto(false)}>להישאר</button>
            </div>
          </div>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary confirm" type="submit" disabled={busy}>
          {busy ? <><span className="spinner spinner-inline" aria-hidden="true" /> שומר…</> : "אישור"}
        </button>
      </form>
      {busy ? (
        <div className="save-overlay" role="status">
          <span className="spinner" aria-hidden="true" />
          <strong>שומר את התמונה</strong>
        </div>
      ) : null}
    </section>
  )
}

function changeQuantity(current, delta, setQuantity) {
  const next = Math.max(0, (Number(current) || 0) + delta)
  setQuantity(next ? String(next) : "")
}

function captureFrame(video) {
  const width = video?.videoWidth
  const height = video?.videoHeight
  if (!width || !height) return ""
  const scale = Math.min(1, 1600 / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.82)
}

async function openCamera(video) {
  const attempts = [
    { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    { facingMode: "environment" },
    true,
  ]
  let lastError = null
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraints })
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()
      return stream
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error("המצלמה לא נפתחה")
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}
