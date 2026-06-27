// Vercel serverless — FIFA 2026 HLS streams from lchdxfootball premium.js
// Fetches the live streamMap on every request — URLs auto-refresh whenever the
// source operator updates the file.  No hardcoded stream URLs needed.
// Referer-locked: only cricfusion.vercel.app and localhost may fetch this.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const PREMIUM_JS_URL = 'https://lchdxfootball.pages.dev/premium.js'

// FIFA-relevant channels in the streamMap and their display metadata.
// IDs are the keys in the streamMap object inside premium.js.
const META = {
  U1: { name: 'Fox Sports HD',    logo: 'FOX', language: 'English',    badge: 'HD' },
  U2: { name: 'Fox Sports 1 HD',  logo: 'FOX', language: 'English',    badge: 'HD' },
  U3: { name: 'CC5 Chinese HD',   logo: 'CC5', language: 'Chinese',    badge: 'HD' },
  U4: { name: 'CC4 Chinese HD',   logo: 'CC4', language: 'Chinese',    badge: 'HD' },
  U5: { name: 'TRC Spanish HD',   logo: 'TRC', language: 'Spanish',    badge: 'HD' },
  U6: { name: 'TRC Spanish HD 2', logo: 'TRC', language: 'Spanish',    badge: 'HD' },
  U7: { name: 'SA1 HD',           logo: 'SA1', language: 'Arabic',     badge: 'HD' },
  U8: { name: 'TSN Extra HD',     logo: 'TSN', language: 'English',    badge: 'HD' },
  U:  { name: 'Globo Brazil HD',  logo: 'GLB', language: 'Portuguese', badge: 'HD' },
}

let _id = 600

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  try {
    const resp = await fetch(PREMIUM_JS_URL, { cache: 'no-store' })
    if (!resp.ok) return res.status(502).end(`Upstream error: ${resp.status}`)

    const js = await resp.text()

    // Extract url values: "ID": { url: "https://...", ... }
    const urlMap = {}
    const re = /"([^"]+)":\s*\{\s*url:\s*"([^"]*)"[^}]*\}/gs
    let m
    while ((m = re.exec(js)) !== null) {
      urlMap[m[1]] = m[2]
    }

    _id = 600
    const channels = []

    for (const [id, meta] of Object.entries(META)) {
      const url = urlMap[id]
      if (!url) continue
      channels.push({
        id:          _id++,
        key:         `cxfut_${id.toLowerCase()}`,
        name:        meta.name,
        match:       'FIFA World Cup 2026 — Live',
        logo:        meta.logo,
        badge:       meta.badge,
        language:    meta.language,
        description: `FIFA World Cup 2026 — ${meta.name}`,
        url,
        keyId:       null,
        drmKey:      null,
      })
    }

    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(channels)
  } catch (err) {
    res.status(502).end(`Proxy error: ${err.message}`)
  }
}
