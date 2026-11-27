import * as ZXing from "html5-qrcode/third_party/zxing-js.umd.js"

const zxing = ZXing.default || ZXing
const DEFAULT_ZOOM = 2.5

const CAMERA_ATTEMPTS = [
  {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  { facingMode: "environment" },
]

export function createQrCamera(video, onCode) {
  let stream = null
  let timer = 0
  let stopped = false
  let reading = false
  let pass = 0
  let nativeMisses = 0
  let detector = createDetector()
  let torchOn = false
  let digitalZoom = 1
  let zoomState = null
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  async function start() {
    let lastError = null
    for (const constraints of CAMERA_ATTEMPTS) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: constraints })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          stream = null
          return null
        }
        break
      } catch (err) {
        lastError = err
      }
    }
    if (stopped) return null
    if (!stream) throw lastError || new Error("המצלמה לא זמינה")

    const track = stream.getVideoTracks()[0]
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.setAttribute("playsinline", "true")
    await video.play()
    if (stopped) {
      stream.getTracks().forEach((item) => item.stop())
      stream = null
      video.srcObject = null
      return null
    }
    const torch = await tuneTrack(track)
    zoomState = readZoom(track)
    const zoom = await applyZoom(DEFAULT_ZOOM)
    schedule()
    return { torch, zoom }
  }

  async function applyZoom(next) {
    const track = stream?.getVideoTracks()[0]
    if (!zoomState || !track) return zoomState ? { ...zoomState } : null
    const value = clampZoom(next, zoomState)
    zoomState = { ...zoomState, value }
    if (zoomState.hardware) {
      const applied = await applyHardwareZoom(track)
      if (!applied) {
        zoomState = { ...DIGITAL_ZOOM, value: clampZoom(value, DIGITAL_ZOOM) }
      }
    }
    if (zoomState.hardware) {
      digitalZoom = 1
      video.style.transform = ""
    } else {
      digitalZoom = zoomState.value
      video.style.transformOrigin = "center center"
      video.style.transform = digitalZoom > 1.01 ? `scale(${digitalZoom})` : ""
    }
    return { ...zoomState }
  }

  function schedule() {
    if (stopped) return
    timer = window.setTimeout(async () => {
      if (!stopped && !reading && video.readyState >= 2) {
        reading = true
        try {
          const text = await readFrame()
          if (text && !stopped) onCode(text)
        } catch {
          // A missed frame is normal. The next one tries again.
        }
        reading = false
      }
      schedule()
    }, 90)
  }

  async function readFrame() {
    if (detector) {
      const frame = drawFrame(video, 1920)
      if (!frame) return ""
      try {
        const codes = await withTimeout(detector.detect(frame), 400)
        const hit = codes?.find((code) => code.rawValue)
        if (hit?.rawValue) {
          nativeMisses = 0
          return hit.rawValue
        }
      } catch (err) {
        if (err?.message !== "timeout") detector = null
      }
      if (detector) {
        nativeMisses += 1
        if (nativeMisses % 5 !== 0) return ""
      }
    }
    if (!drawFrame(video, 1100)) return ""
    return readWithZxing()
  }

  function drawFrame(source, maxEdge) {
    const width = source.videoWidth
    const height = source.videoHeight
    if (!width || !height || !context) return null
    pass += 1
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    if (canvas.width !== targetWidth) canvas.width = targetWidth
    if (canvas.height !== targetHeight) canvas.height = targetHeight
    context.imageSmoothingEnabled = false
    const zoom = digitalZoom > 1.01 ? digitalZoom : 0
    const crop = !zoom && !detector && pass % 2 === 0
    if (zoom) {
      const cropWidth = width / zoom
      const cropHeight = height / zoom
      context.drawImage(
        source,
        (width - cropWidth) / 2,
        (height - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      )
    } else if (crop) {
      const cropWidth = width * 0.62
      const cropHeight = height * 0.62
      context.drawImage(
        source,
        (width - cropWidth) / 2,
        (height - cropHeight) / 2,
        cropWidth,
        cropHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      )
    } else {
      context.drawImage(source, 0, 0, targetWidth, targetHeight)
    }
    return canvas
  }

  function currentAdvanced(track) {
    const caps = track.getCapabilities?.() || {}
    const item = {}
    if (caps.focusMode?.includes("continuous")) item.focusMode = "continuous"
    if (caps.exposureMode?.includes("continuous")) item.exposureMode = "continuous"
    if (caps.whiteBalanceMode?.includes("continuous")) item.whiteBalanceMode = "continuous"
    if (zoomState?.hardware) item.zoom = zoomState.value
    if (caps.torch) item.torch = torchOn
    return item
  }

  async function applyHardwareZoom(track) {
    try {
      await track.applyConstraints({ advanced: [currentAdvanced(track)] })
      return true
    } catch {
      try {
        await track.applyConstraints({ zoom: zoomState.value })
        return true
      } catch {
        return false
      }
    }
  }

  function readWithZxing() {
    const hints = new Map()
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.QR_CODE])
    hints.set(zxing.DecodeHintType.TRY_HARDER, true)
    const sourceImage = new zxing.HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(sourceImage))
    try {
      return new zxing.QRCodeReader().decode(bitmap, hints)?.text || ""
    } catch {
      return ""
    }
  }

  return {
    start,
    async setTorch(on) {
      const track = stream?.getVideoTracks()[0]
      if (!track) return
      const previous = torchOn
      torchOn = on
      try {
        await track.applyConstraints({ advanced: [currentAdvanced(track)] })
      } catch {
        try {
          await track.applyConstraints({ advanced: [{ torch: on }] })
        } catch (err) {
          torchOn = previous
          throw err
        }
      }
    },
    async setZoom(next) {
      return applyZoom(next)
    },
    async stop() {
      stopped = true
      window.clearTimeout(timer)
      digitalZoom = 1
      zoomState = null
      torchOn = false
      video.style.transform = ""
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      if (video.srcObject) video.srcObject = null
    },
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

const DIGITAL_ZOOM = { min: 1, max: 4, step: 0.1, value: 1, hardware: false }

function readZoom(track) {
  const caps = track.getCapabilities?.() || {}
  const range = caps.zoom
  const current = track.getSettings?.().zoom
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min + 0.05) {
    return { ...DIGITAL_ZOOM }
  }
  const max = Math.min(range.max, 8)
  const step = range.step > 0 ? range.step : 0.1
  const value = clampZoom(current ?? range.min, { min: range.min, max, step })
  return { min: range.min, max, step, value, hardware: true }
}

function clampZoom(value, range) {
  const number = Number(value)
  const safe = Number.isFinite(number) ? number : range.min
  const clamped = Math.min(range.max, Math.max(range.min, safe))
  if (!range.step) return clamped
  const steps = Math.round((clamped - range.min) / range.step)
  const snapped = range.min + steps * range.step
  return Math.min(range.max, Math.round(snapped * 1000) / 1000)
}

function createDetector() {
  if (!("BarcodeDetector" in globalThis)) return null
  try {
    return new BarcodeDetector({ formats: ["qr_code"] })
  } catch {
    return null
  }
}

async function tuneTrack(track) {
  const caps = track.getCapabilities?.() || {}
  const advanced = []
  if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" })
  if (caps.exposureMode?.includes("continuous")) advanced.push({ exposureMode: "continuous" })
  if (caps.whiteBalanceMode?.includes("continuous")) advanced.push({ whiteBalanceMode: "continuous" })
  if (advanced.length) {
    try {
      await track.applyConstraints({ advanced })
    } catch {
      // The camera still works without these modes.
    }
  }
  return Boolean(caps.torch)
}
