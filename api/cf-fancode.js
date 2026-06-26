// Vercel serverless — proxies FanCode live events server-side.
// Upstream URL is never exposed to the browser.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const UPSTREAM = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json'

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  if (!ALLOWED.some((o) => referer.startsWith(o))) return res.status(403).end('Forbidden')

  try {
    const r = await fetch(UPSTREAM, { cache: 'no-store', credentials: 'omit' })
    const text = await r.text()
    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).end(text)
  } catch (err) {
    res.status(502).end('Proxy error')
  }
}
