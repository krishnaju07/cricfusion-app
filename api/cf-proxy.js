// Merged proxy: replaces cf-data.js, cf-fancode.js, cf-sonyliv.js
// SW calls /api/cf-proxy?src=data|fancode|sonyliv
// Upstream URLs are never exposed to the browser.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const UPSTREAMS = {
  fancode: 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json',
  sonyliv: 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json',
}

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  if (!ALLOWED.some((o) => referer.startsWith(o))) return res.status(403).end('Forbidden')

  const src = req.query?.src
  const upstream = UPSTREAMS[src]
  if (!upstream) return res.status(400).end(`Unknown src: ${src}`)

  try {
    const r = await fetch(upstream, { cache: 'no-store', credentials: 'omit' })
    const text = await r.text()
    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).end(text)
  } catch {
    res.status(502).end('Proxy error')
  }
}
