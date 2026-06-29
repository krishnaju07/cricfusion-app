// Vercel serverless — DASH stream proxy for footballapi / footsters streams.
// Sets Origin: https://footsters-tv.pages.dev so CDN accepts requests from
// cricfusion.vercel.app (browser Origin is blocked from JS; proxy fixes it).
//
// Route (vercel.json): /cf-stream/(.*) → /api/cf-stream?path=$1
// Channel URL format:  /cf-stream/<host>/<path>.mpd
//
// Shaka resolves relative segment URLs against the MPD base URL, so every
// subsequent segment request also routes here automatically.

const ALLOWED_REFERERS = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const STREAM_ORIGIN  = 'https://footsters-tv.pages.dev'
const STREAM_REFERER = 'https://footsters-tv.pages.dev/'

// CDN hosts used by footballapi streams — extend if new hosts appear
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
        'user-agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        accept:               '*/*',
        dnt:                  '1',
        'sec-fetch-dest':     'empty',
        'sec-fetch-mode':     'cors',
        'sec-fetch-site':     'cross-site',
        'sec-ch-ua':          '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile':   '?0',
        'sec-ch-ua-platform': '"Windows"',
        ...(req.headers['range'] && { range: req.headers['range'] }),
      },
    })
  } catch {
    return res.status(502).end('Upstream fetch failed')
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream')
  if (r.headers.get('content-length')) {
    res.setHeader('Content-Length', r.headers.get('content-length'))
  }

  // MPD manifest: rewrite absolute CDN URLs so Shaka routes them back through this proxy
  if (upstream.endsWith('.mpd') || (r.headers.get('content-type') || '').includes('dash+xml')) {
    let text = await r.text()
    for (const h of ALLOWED_HOSTS) {
      text = text.replaceAll(`https://${h}/`, `/cf-stream/${h}/`)
    }
    return res.status(r.status).send(text)
  }

  // Segments / init: pipe binary directly
  const buf = Buffer.from(await r.arrayBuffer())
  return res.status(r.status).send(buf)
}
