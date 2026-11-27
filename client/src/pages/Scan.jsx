import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { buildDescription, parseLoadCode, parseSize } from "../../../shared/tireFields.js"
import { createQrCamera } from "../qrCamera.js"
import { EXAMPLE_EPREL, api, readWarehouse, saveWarehouse } from "../api.js"

const MISSING = "לא נסרק צמיג או לא הוקלדה כמות במלאי לא ניתן לשמור"
const SAME_CODE_MS = 2500
const AFTER_SAVE_MS = 8000
const MODES = {
  count: {
    path: "/count/scan",
    back: "/count",
    title: "סריקת QR",
    quantity: "כמות במלאי",
    notice: "הפריט נקלט",
  },
  in: {
    path: "/in",
    back: "/",
    title: "קליטה למלאי",
    quantity: "כמות קליטה למלאי",
    notice: "הפריט נקלט",
  },
  out: {
    path: "/out",
    back: "/",
    title: "הוצאה ממלאי",
    quantity: "כמות הוצאה מהמלאי",
    notice: "הפריט הוצא",
  },
}

const EMPTY_MANUAL = {
  manufacturerId: "",
  manufacturerName: "",
  size: "",
  model: "",
  loadCode: "",
  loadVersion: "",
}

export function Scan({ mode = "count" }) {
  const flow = MODES[mode] || MODES.count
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const finderRef = useRef(null)
  const cameraRef = useRef(null)
  const zoomRef = useRef(null)
  const zoomRequest = useRef(0)
  const readCodeRef = useRef(() => {})
  const gateRef = useRef({ code: "", until: 0, busy: false })
  const savingRef = useRef(false)
  const manualOnRef = useRef(false)
  const scanGeneration = useRef(0)
  const cameraToken = useRef(0)
  const [warehouse, setWarehouse] = useState(() => readWarehouse())
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(true)
  const [cameraError, setCameraError] = useState("")
  const [torchOn, setTorchOn] = useState(false)
  const [torchReady, setTorchReady] = useState(false)
  const [zoom, setZoomLevel] = useState(null)
  const [code, setCode] = useState("")
  const [draft, setDraft] = useState("")
  const [tire, setTire] = useState(null)
  const [quantity, setQuantity] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState("")
  const [manualOn, setManualOn] = useState(false)
  const [manual, setManual] = useState(EMPTY_MANUAL)
  const [manualOurId, setManualOurId] = useState("")
  const [pendingOurId, setPendingOurId] = useState("")
  const [canManual, setCanManual] = useState(false)
  const [makers, setMakers] = useState([])
  const [makerDraft, setMakerDraft] = useState("")

  useEffect(() => {
    startCamera()
    return () => {
      cameraToken.current += 1
      cameraRef.current?.stop()
      cameraRef.current = null
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
          setError("אין מחסנים לחברה הזו.")
        }
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    manualOnRef.current = manualOn
  }, [manualOn])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(""), 1800)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const node = finderRef.current
    if (!node || !cameraOn) return undefined
    let pinch = null
    function onStart(event) {
      if (event.touches.length !== 2 || !zoomRef.current) return
      pinch = {
        distance: touchDistance(event.touches),
        zoom: zoomRef.current.value,
      }
    }
    function onMove(event) {
      if (!pinch || event.touches.length !== 2) return
      event.preventDefault()
      const ratio = touchDistance(event.touches) / pinch.distance
      changeZoom(pinch.zoom * ratio)
    }
    function onEnd() {
      pinch = null
    }
    node.addEventListener("touchstart", onStart, { passive: true })
    node.addEventListener("touchmove", onMove, { passive: false })
    node.addEventListener("touchend", onEnd)
    node.addEventListener("touchcancel", onEnd)
    return () => {
      node.removeEventListener("touchstart", onStart)
      node.removeEventListener("touchmove", onMove)
      node.removeEventListener("touchend", onEnd)
      node.removeEventListener("touchcancel", onEnd)
    }
  }, [cameraOn])

  readCodeRef.current = readCode

  async function startCamera() {
    if (cameraRef.current) return
    const token = cameraToken.current + 1
    cameraToken.current = token
    setCameraError("")
    setCameraStarting(true)
    const camera = createQrCamera(videoRef.current, (text) => readCodeRef.current(text))
    cameraRef.current = camera
    try {
      const info = await camera.start()
      if (token !== cameraToken.current) {
        await camera.stop()
        if (cameraRef.current === camera) cameraRef.current = null
        return
      }
      if (!info) {
        cameraRef.current = null
        setCameraStarting(false)
        return
      }
      setTorchReady(info.torch)
      setTorchOn(false)
      zoomRef.current = info.zoom
      setZoomLevel(info.zoom)
      setCameraOn(true)
      setCameraStarting(false)
    } catch (err) {
      await camera.stop()
      if (cameraRef.current === camera) cameraRef.current = null
      if (token !== cameraToken.current) return
      setCameraOn(false)
      setCameraStarting(false)
      setTorchReady(false)
      zoomRef.current = null
      setZoomLevel(null)
      const detail = err && (err.message || String(err))
      setCameraError(detail ? `המצלמה לא נפתחה: ${detail}` : "המצלמה לא נפתחה. אפשר להדביק את קישור ה-QR.")
    }
  }

  async function stopCamera() {
    cameraToken.current += 1
    await cameraRef.current?.stop()
    cameraRef.current = null
    setCameraOn(false)
    setCameraStarting(false)
    setTorchOn(false)
    setTorchReady(false)
    zoomRef.current = null
    setZoomLevel(null)
  }

  function changeZoom(value) {
    const current = zoomRef.current
    if (!current) return
    const request = zoomRequest.current + 1
    zoomRequest.current = request
    const optimistic = { ...current, value: snapZoom(value, current) }
    zoomRef.current = optimistic
    setZoomLevel(optimistic)
    cameraRef.current?.setZoom(value).then((next) => {
      if (!next || request !== zoomRequest.current) return
      zoomRef.current = next
      setZoomLevel(next)
    }).catch(() => {})
  }

  async function toggleTorch() {
    const next = !torchOn
    try {
      await cameraRef.current?.setTorch(next)
      setTorchOn(next)
    } catch (err) {
      setCameraError(err?.message || "הפנס לא נדלק")
    }
  }

  async function readCode(raw) {
    const trimmed = String(raw || "").trim()
    if (!trimmed) return
    const gate = gateRef.current
    const now = Date.now()
    if (gate.busy || (gate.code === trimmed && now < gate.until)) return
    const generation = scanGeneration.current
    gate.busy = true
    gate.code = trimmed
    gate.until = now + SAME_CODE_MS
    setBusy("read")
    setError("")
    setNotice("")
    setCanManual(false)
    try {
      const data = await api.preview(trimmed)
      if (generation !== scanGeneration.current) return
      gate.code = trimmed
      gate.until = Number.POSITIVE_INFINITY
      setCode(trimmed)
      setDraft(trimmed)
      setTire(data.tire)
      setManualOn(false)
      setQuantity("")
    } catch (err) {
      if (generation !== scanGeneration.current) return
      gate.until = Date.now() + SAME_CODE_MS
      if (!manualOnRef.current) {
        setTire(null)
        setCode("")
        setError(err.message)
        setCanManual(err.code === "not-found")
        setPendingOurId(err.ourId || "")
      }
    } finally {
      if (generation !== scanGeneration.current) return
      gate.busy = false
      setBusy("")
    }
  }

  function clearScan() {
    scanGeneration.current += 1
    gateRef.current = { code: "", until: 0, busy: false }
    setTire(null)
    setCode("")
    setDraft("")
    setQuantity("")
    setManualOn(false)
    setManual(EMPTY_MANUAL)
    setManualOurId("")
    setPendingOurId("")
    setCanManual(false)
    setMakerDraft("")
    setError("")
    setNotice("")
    setBusy("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function openManual() {
    setManualOn(true)
    setTire(null)
    setCode("")
    setCanManual(false)
    setManualOurId(pendingOurId)
    setError("")
    gateRef.current.until = Number.POSITIVE_INFINITY
    try {
      const data = await api.manufacturers()
      setMakers(data.manufacturers || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function addMaker() {
    const name = makerDraft.trim()
    if (!name) return
    setBusy("add")
    setError("")
    try {
      const data = await api.addManufacturer(name)
      const manufacturer = data.manufacturer
      setMakers((current) => {
        if (current.some((item) => item.id === manufacturer.id)) return current
        return [...current, manufacturer].sort((a, b) => a.name.localeCompare(b.name, "he"))
      })
      setManual((current) => ({
        ...current,
        manufacturerId: String(manufacturer.id),
        manufacturerName: manufacturer.name,
      }))
      setMakerDraft("")
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy("")
    }
  }

  async function onConfirm(event) {
    event.preventDefault()
    if (savingRef.current) return
    const qty = Number(quantity)
    const manualReady = manual.manufacturerId && manual.size.trim() && manual.loadCode.trim()
    if (!warehouse) {
      setError("צריך לבחור מחסן")
      return
    }
    if ((!tire && !manualOn) || (manualOn && !manualReady) || !Number.isInteger(qty) || qty < 1) {
      setError(MISSING)
      return
    }
    savingRef.current = true
    setBusy("save")
    setError("")
    const payload = {
      warehouseId: warehouse.id,
      quantity: qty,
      ...(manualOn ? { manual: { ...manual, ourId: manualOurId } } : { code }),
    }
    try {
      if (mode === "count") await api.saveCount(payload)
      else await api.saveMovement({ ...payload, direction: mode })
      gateRef.current.code = code || manualOurId
      gateRef.current.until = Date.now() + AFTER_SAVE_MS
      setTire(null)
      setCode("")
      setDraft("")
      setQuantity("")
      setManualOn(false)
      setManual(EMPTY_MANUAL)
      setManualOurId("")
      setPendingOurId("")
      setCanManual(false)
      setNotice(flow.notice)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError(err.message)
    } finally {
      savingRef.current = false
      setBusy("")
    }
  }

  function changeQuantity(next) {
    if (next === "") {
      setQuantity("")
      return
    }
    const value = Math.max(1, Math.trunc(Number(next) || 0))
    setQuantity(String(value))
  }

  function chooseMaker(id) {
    const found = makers.find((item) => String(item.id) === id)
    setManual((current) => ({
      ...current,
      manufacturerId: id,
      manufacturerName: found?.name || "",
    }))
  }

  const ready = Boolean(tire || manualOn)
  const parsedSize = parseSize(manual.size)
  const parsedLoad = parseLoadCode(manual.loadCode)
  const manualDescription = parsedSize && parsedLoad
    ? buildDescription({
      size: parsedSize.size,
      strength: parsedLoad.strength,
      speed: parsedLoad.speed,
      model: manual.model,
      loadVersion: manual.loadVersion,
    })
    : ""

  return (
    <section className={ready ? "scan-page has-save" : "scan-page"}>
      <div className="scan-head">
        <button type="button" className="text-back" onClick={() => navigate(flow.back)}>חזרה</button>
        {mode === "count" ? (
          <button type="button" className="button ghost big" onClick={() => navigate("/count/hand")}>
            הכנס ידנית - ללא QR Code
          </button>
        ) : null}
        <h1>{flow.title}</h1>
        <button
          type="button"
          className="warehouse-field"
          onClick={() => navigate(`/count/warehouse?return=${encodeURIComponent(flow.path)}`)}
        >
          <small>מחסן</small>
          <strong>{warehouse?.description || "בחירה"}</strong>
        </button>
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <div className="scan-grid">
        <div className="panel">
          <div className="viewfinder" ref={finderRef}>
            <video ref={videoRef} className="scan-video" autoPlay muted playsInline />
            {cameraOn && zoom ? (
              <label className="zoom-control">
                <span>{formatZoom(zoom.value)}</span>
                <input
                  type="range"
                  min={zoom.min}
                  max={zoom.max}
                  step={zoom.step}
                  value={snapZoom(zoom.value, zoom)}
                  aria-label="זום"
                  onChange={(event) => changeZoom(event.target.value)}
                />
              </label>
            ) : null}
            {cameraOn ? (
              <div className="viewfinder-status" role="status">{busy === "read" ? "מעבד נתונים" : "סורק"}</div>
            ) : (
              <div className="viewfinder-idle">{cameraStarting ? "פותח מצלמה" : "המצלמה כבויה"}</div>
            )}
          </div>
          {cameraError ? <p className="form-error">{cameraError}</p> : null}
          <div className="row-actions">
            {cameraOn ? (
              <>
                <button type="button" className="button ghost big" onClick={stopCamera}>עצור מצלמה</button>
                {torchReady ? (
                  <button type="button" className="button ghost big" onClick={toggleTorch}>
                    {torchOn ? "כבה פנס" : "הדלק פנס"}
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="button primary big" onClick={startCamera}>פתח מצלמה</button>
            )}
          </div>
          <form className="stack" onSubmit={(event) => { event.preventDefault(); readCode(draft) }}>
            <label>
              הדבקת קישור QR
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="הדביקו כאן את הקישור"
                dir={draft.trim() ? "ltr" : "rtl"}
                enterKeyHint="go"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <div className="row-actions">
              <button type="submit" className="button ghost" disabled={Boolean(busy) || !draft.trim()}>
                {busy === "read" ? "קורא…" : "קרא מהקישור"}
              </button>
              <button type="button" className="button ghost" onClick={() => setDraft(EXAMPLE_EPREL)}>הדבק דוגמה</button>
            </div>
          </form>
        </div>

        <form className="panel tire-form" onSubmit={onConfirm}>
          {tire ? (
            <>
              <Field label="יצרן" value={tire.manufacturerName} />
              <Field label="גודל צמיג" value={tire.size} ltr />
              <SizeSplit wide={tire.wide} hatach={tire.hatach} hight={tire.hight} />
              <Field label="דגם" value={tire.degem} />
              <Field label="קוד עומס" value={tire.loadCode} ltr />
              <Field label="תאור צמיג" value={tire.description} ltr />
            </>
          ) : null}
          {manualOn ? (
            <>
              <label>
                יצרן
                <select value={manual.manufacturerId} onChange={(event) => chooseMaker(event.target.value)}>
                  <option value="">{makers.length ? "בחרו יצרן" : "אין יצרנים לחברה"}</option>
                  {makers.map((maker) => (
                    <option key={maker.id} value={maker.id}>{maker.name}</option>
                  ))}
                </select>
              </label>
              <div className="maker-add">
                <label>
                  הוספת יצרן
                  <input
                    value={makerDraft}
                    onChange={(event) => setMakerDraft(event.target.value)}
                    dir={/[A-Za-z]/.test(makerDraft) ? "ltr" : "rtl"}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </label>
                <button type="button" className="button ghost" disabled={Boolean(busy) || !makerDraft.trim()} onClick={addMaker}>
                  {busy === "add" ? "מוסיף…" : "הוסף"}
                </button>
              </div>
              <label>
                גודל צמיג
                <input
                  value={manual.size}
                  onChange={(event) => setManual({ ...manual, size: event.target.value })}
                  dir="ltr"
                  placeholder="215/55ZR17"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>
              {manual.size && !parsedSize ? (
                <p className="form-error">לא הצלחתי לקרוא רוחב, חתך וגובה ממידת הצמיג</p>
              ) : null}
              {parsedSize ? <SizeSplit wide={parsedSize.wide} hatach={parsedSize.hatach} hight={parsedSize.hight} /> : null}
              <label>
                דגם
                <input
                  value={manual.model}
                  onChange={(event) => setManual({ ...manual, model: event.target.value })}
                  dir={/[A-Za-z]/.test(manual.model) ? "ltr" : "rtl"}
                />
              </label>
              <label>
                קוד עומס
                <input
                  value={manual.loadCode}
                  onChange={(event) => setManual({ ...manual, loadCode: event.target.value })}
                  dir="ltr"
                  placeholder="98W"
                  autoCapitalize="characters"
                />
              </label>
              <label>
                נתון נוסף
                <input
                  value={manual.loadVersion}
                  onChange={(event) => setManual({ ...manual, loadVersion: event.target.value })}
                  dir="ltr"
                  placeholder="XL"
                  autoCapitalize="characters"
                />
              </label>
              <Field label="תאור צמיג" value={manualDescription} ltr />
            </>
          ) : null}
          {!ready ? (
            <div className="wait-copy">
              <h2>הצמיג יופיע כאן</h2>
              <p>אחרי קריאת ה-QR ממלאים רק כמות ולוחצים אישור. המסך מתנקה לבד לסריקה הבאה.</p>
            </div>
          ) : null}
          {ready ? (
            <div className="save-dock">
              <div className="qty-block">
                <span>{flow.quantity}</span>
                <div className="qty" dir="ltr">
                  <button type="button" onClick={() => changeQuantity((Number(quantity) || 1) - 1)} aria-label="הפחת כמות">−</button>
                  <input
                    inputMode="numeric"
                    enterKeyHint="done"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ""))}
                    aria-label={flow.quantity}
                  />
                  <button type="button" onClick={() => changeQuantity((Number(quantity) || 0) + 1)} aria-label="הוסף כמות">+</button>
                </div>
              </div>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="button primary confirm" type="submit" disabled={Boolean(busy)}>
                {busy === "save" ? "שומר…" : "אישור"}
              </button>
              <button type="button" className="button ghost big" onClick={clearScan} disabled={busy === "save"}>
                ניקוי
              </button>
            </div>
          ) : null}
          {!ready && error ? <p className="form-error" role="alert">{error}</p> : null}
          {!ready && canManual ? (
            <button type="button" className="button primary" onClick={openManual}>הקמה ידנית</button>
          ) : null}
        </form>
      </div>
    </section>
  )
}

function snapZoom(value, range) {
  const number = Number(value)
  if (!range || !Number.isFinite(number)) return range?.min ?? 1
  if (!range.step) return Math.min(range.max, Math.max(range.min, number))
  const steps = Math.round((number - range.min) / range.step)
  const snapped = Math.round((range.min + steps * range.step) * 1000) / 1000
  return Math.min(range.max, Math.max(range.min, snapped))
}

function formatZoom(value) {
  const rounded = Math.round(Number(value) * 10) / 10
  if (!Number.isFinite(rounded)) return "1×"
  return Number.isInteger(rounded) ? `${rounded}×` : `${rounded.toFixed(1)}×`
}

function touchDistance(touches) {
  const [first, second] = touches
  const dx = first.clientX - second.clientX
  const dy = first.clientY - second.clientY
  return Math.hypot(dx, dy) || 1
}

function Field({ label, value, ltr = false }) {
  return (
    <label>
      {label}
      <input value={value || ""} readOnly dir={ltr ? "ltr" : undefined} />
    </label>
  )
}

function SizeSplit({ wide, hatach, hight }) {
  return (
    <div className="split-size" dir="ltr">
      <SizeBox label="רוחב" value={wide} />
      <span>/</span>
      <SizeBox label="חתך" value={hatach} />
      <span>/</span>
      <SizeBox label="גובה" value={hight} />
    </div>
  )
}

function SizeBox({ label, value }) {
  return (
    <p>
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  )
}

