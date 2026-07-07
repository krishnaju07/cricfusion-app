// Vercel Node Function — Germany geo proxy via a residential proxy upstream.
//
// Some channels (Sportdigital Fussball on t-online/Akamai) are geo-locked to
// Germany AND block datacenter IPs — so a plain Frankfurt datacenter (Vercel
// fra1) gets 403'd. To pass, we route the outgoing request through a RESIDENTIAL
// German proxy whose credentials live in the GEO_PROXY_URL env var, e.g.
//   GEO_PROXY_URL=http://user:pass@de.provider.com:8080
// Set it in Vercel → Project → Settings → Environment Variables.
//
// Path-based, like fc-cdn: the channel URL is /cf-geo/<host>/<path>/index.mpd.
// The DASH manifest is served from this same proxied path, so Shaka resolves
// every relative segment back through here automatically; absolute upstream URLs
// are rewritten too. ClearKey decryption stays client-side in Shaka — this only
// relays bytes from a German residential IP.
//
// NOTE: residential proxies are metered per-GB and video is heavy. This is
// deliberately scoped to the t-online Fussball hosts only.

import { ProxyAgent } from 'undici'

const ALLOWED_HOSTS = [
  'svc45.main.sl.t-online.de',
  'svc44.main.sl.t-online.de',
  'svc46.main.sl.t-online.de',
]

const ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cricfusion.netlify.app'
]

let agent = null
function getAgent() {
  const proxy = process.env.GEO_PROXY_URL
  if (!proxy) return null
  if (!agent) agent = new ProxyAgent(proxy)
  return agent
}

export default async function handler(req, res) {
  // Referer-gate browser calls; allow empty referers (a Chromecast sends none).
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  if (referer && !ALLOWED.some((o) => referer.startsWith(o))) {
    return res.status(403).end('Forbidden')
  }

  const path = req.query.path || ''
  const slash = path.indexOf('/')
  const host = slash === -1 ? path : path.slice(0, slash)
  if (!ALLOWED_HOSTS.includes(host)) {
    return res.status(400).end('Host not allowed')
  }

  // Preserve original upstream query params (tokens etc.), minus our 'path'.
  const params = new URLSearchParams(req.query)
  params.delete('path')
  const qs = params.toString()
  const upstream = `https://${path}${qs ? '?' + qs : ''}`

  const dispatcher = getAgent()
  if (!dispatcher) {
    return res.status(503).end('Geo proxy not configured (GEO_PROXY_URL missing)')
  }

  let resp
  try {
    resp = await fetch(upstream, {
      dispatcher,
      headers: {
        accept: req.headers['accept'] || '*/*',
        'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
      },
    })
  } catch (e) {
    return res.status(502).end('Geo proxy fetch error: ' + e.message)
  }

  if (!resp.ok) {
    return res.status(resp.status).end(`Upstream ${resp.status}`)
  }

  const ct = resp.headers.get('content-type') || 'application/octet-stream'
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.setHeader('Content-Type', ct)

  // Rewrite absolute upstream URLs in the DASH manifest back through this proxy.
  if (ct.includes('dash+xml') || path.endsWith('.mpd')) {
    let text = await resp.text()
    for (const h of ALLOWED_HOSTS) {
      text = text.split(`https://${h}/`).join(`/cf-geo/${h}/`)
    }
    return res.status(200).send(text)
  }

  // Stream binary segments straight through.
  const buf = Buffer.from(await resp.arrayBuffer())
  return res.status(200).send(buf)
}
