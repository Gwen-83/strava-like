import type { ActivityDetails } from "../types/Activity"

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const decodePolyline = (str: string) => {
  const coordinates: [number, number][] = []
  let index = 0, lat = 0, lng = 0

  while (index < str.length) {
    let result = 0, shift = 0, b
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += deltaLat

    result = 0; shift = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += deltaLng

    coordinates.push([lat / 1e5, lng / 1e5])
  }

  return coordinates
}

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const drawCard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 20,
  bg = "#ffffff"
) => {
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.15)"
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10
  ctx.fillStyle = bg
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
}

const computeDerived = (act: ActivityDetails) => {
  const distance_km = act.distance_m != null ? act.distance_m / 1000 : null
  const avg_speed_kmh = act.avg_speed_ms != null ? +(act.avg_speed_ms * 3.6).toFixed(2) : null
  const elevation_per_km = (act.elevation_m != null && distance_km && distance_km > 0) ? +(act.elevation_m / distance_km).toFixed(2) : null
  const load_per_hour = (act.load != null && act.duration_s && act.duration_s > 0) ? +(act.load / (act.duration_s/3600)).toFixed(2) : null

  let coherence_score = 0
  if (act.avg_speed_ms != null && act.max_speed_ms != null && act.max_speed_ms > 0) {
    coherence_score = Math.round(Math.min(100, (act.avg_speed_ms / act.max_speed_ms) * 100))
  } else {
    const checks = [
      !!act.has_gps,
      !!act.has_power,
      !!act.avg_hrt
    ]
    coherence_score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }

  return { distance_km, avg_speed_kmh, elevation_per_km, load_per_hour, coherence_score }
}

const FIELD_OPTIONS: { [k: string]: (act: ActivityDetails) => string } = {
  distance: (a) => {
    const d = computeDerived(a).distance_km
    return d != null ? `${d.toFixed(2)} km` : "—"
  },
  duration: (a) => a.duration_s != null ? (() => {
    const seconds = a.duration_s!
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h} h ${m.toString().padStart(2, "0")} min${s > 0 ? ` ${s}s` : ""}`
    if (m > 0) return `${m} min${s > 0 ? ` ${s}s` : ""}`
    return `${s} s`
  })() : "—",
  dplus: (a) => a.elevation_m != null ? `${a.elevation_m} m` : "—",
  load: (a) => a.load != null ? `${a.load}` : "—",
  avg_speed: (a) => {
    const s = computeDerived(a).avg_speed_kmh
    return s != null ? `${s.toFixed(1)} km/h` : "—"
  },
  coherence: (a) => `${computeDerived(a).coherence_score}/100`,
}

export const exportImage = async (
  act: ActivityDetails,
  opts: { theme?: "light" | "dark"; fields?: string[] } = {}
) => {
  const width = 1080
  const height = 1350
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const theme = opts.theme ?? "light"
  const bgTop = theme === "dark" ? "#0f172a" : "#eef2ff"
  const bgBottom = theme === "dark" ? "#020617" : "#ffffff"
  const fg = theme === "dark" ? "#e5e7eb" : "#0f172a"
  const muted = "#6b7280"

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, bgTop)
  grad.addColorStop(1, bgBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  const pad = 60

  // Map card
  const mapX = pad
  const mapY = pad
  const mapW = width - pad * 2
  const mapH = 620

  drawCard(ctx, mapX, mapY, mapW, mapH, 28, theme === "dark" ? "#020617" : "#ffffff")

  if (act.polyline) {
    let pts: [number, number][] = []
    try {
      pts = decodePolyline(act.polyline)
    } catch {}

    if (pts.length > 1) {
      const lats = pts.map(p => p[0])
      const lngs = pts.map(p => p[1])
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)

      const scale = Math.min(
        (mapW - 80) / (maxLng - minLng || 0.0001),
        (mapH - 80) / (maxLat - minLat || 0.0001)
      )

      ctx.save()
      ctx.translate(mapX + mapW / 2, mapY + mapH / 2)
      ctx.beginPath()
      ctx.lineWidth = 6
      ctx.strokeStyle = "#2563eb"
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      pts.forEach(([lat, lng], i) => {
        const x = (lng - (minLng + maxLng) / 2) * scale
        const y = ((minLat + maxLat) / 2 - lat) * scale
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })

      ctx.stroke()
      ctx.restore()
    }
  }

  // Metrics cards
  const fields = opts.fields ?? ["distance", "duration", "dplus", "avg_speed"]

  // allow up to 6 fields (2 columns x up to 3 rows)
  const fieldsToRender = fields.slice(0, 6)
  const columns = 2
  const rows = Math.ceil(fieldsToRender.length / columns)
  const spacing = 24
  const startY = mapY + mapH + 40

  // compute card sizes so they fit vertically in the image
  const availableHeight = height - startY - pad - 80 // reserve bottom/footer space
  const cardH = Math.max(100, Math.floor((availableHeight - (rows - 1) * spacing) / rows))
  const cardW = (width - pad * 2 - spacing) / columns

  fieldsToRender.forEach((key, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = pad + col * (cardW + spacing)
    const y = startY + row * (cardH + spacing)

    drawCard(ctx, x, y, cardW, cardH, 22, theme === "dark" ? "#020617" : "#ffffff")

    ctx.fillStyle = muted
    ctx.font = "20px sans-serif"
    ctx.fillText(
      key === "avg_speed" ? "Vitesse moyenne" :
      key === "dplus" ? "D+" :
      key.charAt(0).toUpperCase() + key.slice(1),
      x + 24,
      y + 36
    )

    ctx.fillStyle = fg
    ctx.font = "48px sans-serif"
    // value vertical placement adapts to computed cardH
    ctx.fillText(
      FIELD_OPTIONS[key](act),
      x + 24,
      y + Math.min(cardH - 24, 96)
    )
  })

  // Footer
  ctx.fillStyle = muted
  ctx.font = "18px sans-serif"
  ctx.fillText(
    `${act.sport ?? ""} • ${act.startDate.toLocaleDateString()}`,
    pad,
    height - 40
  )

  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `activity-${act.id}.png`)
  })
}

export default exportImage
