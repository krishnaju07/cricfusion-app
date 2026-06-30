// Vercel serverless — full DASH proxy for footballapi streams.
// Fetches manifest + segments with Origin: footsters-tv.pages.dev so the
// Amazon IVS CDN accepts requests from cricfusion.vercel.app.
//
// Route (vercel.json): /cf-stream/(.*) → /api/cf-stream?path=$1
// Manifest: rewrites absolute CDN URLs to /cf-stream/… so Shaka routes
//   segment requests back through this proxy automatically.
// Segments: piped directly from CDN.

const ALLOWED_REFERERS = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const STREAM_ORIGIN  = 'https://footsters-tv.pages.dev'
const STREAM_REFERER = 'https://footsters-tv.pages.dev/'

const ALLOWED_HOSTS = new Set([
  'otte.cache.aiv-cdn.net',
  'otte.live.fly.ww.aiv-cdn.net',
  'live-pv-ta.amazon.fastly-edge.com',
  'abgh3fbaaaaaaaambylpff72g6up6.ta.bia-cf.live.pv-cdn.net',
  'a151aivottlinear-a.akamaihd.net',
])

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  if (referer && !ALLOWED_REFERERS.some((o) => referer.startsWith(o))) {
    return res.status(403).end('Forbidden')
  }

  const path = req.query.path || ''
  const slash = path.indexOf('/')
  const host = slash === -1 ? path : path.slice(0, slash)

  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(400).end(`Host not allowed: ${host}`)
  }

  const params = new URLSearchParams(req.query)
  params.delete('path')
  const qs = params.toString()
  const upstream = `https://${path}${qs ? '?' + qs : ''}`

  let r
  try {
    r = await fetch(upstream, {
      headers: {
        origin:               STREAM_ORIGIN,
        referer:              STREAM_REFERER,
        'user-agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        accept:               '*/*',
        'sec-fetch-dest':     'empty',
        'sec-fetch-mode':     'cors',
        'sec-fetch-site':     'cross-site',
        ...(req.headers['range'] && { range: req.headers['range'] }),
      },
    })
  } catch {
    return res.status(502).end('Upstream fetch failed')
  }

  const ct = r.headers.get('content-type') || 'application/octet-stream'
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', ct)

  // Manifest: rewrite absolute CDN URLs so Shaka routes segments back through proxy
  if (upstream.endsWith('.mpd') || ct.includes('dash+xml')) {
    let text = await r.text()
    for (const h of ALLOWED_HOSTS) {
      text = text.replaceAll(`https://${h}/`, `/cf-stream/${h}/`)
    }
    return res.status(r.status).send(text)
  }

  // Segments / init: pipe binary
  const buf = Buffer.from(await r.arrayBuffer())
  if (r.headers.get('content-length')) res.setHeader('Content-Length', r.headers.get('content-length'))
  return res.status(r.status).send(buf)
}
