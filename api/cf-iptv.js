// Vercel serverless — live FIFA/World Cup channels from iptv-eldbert.xyz
// Fetches at request time so tokenized stream URLs are always fresh.
// Referer-locked: only cricfusion.vercel.app and localhost may fetch this.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const IPTV_URL = 'https://iptv-eldbert.xyz/iptv/channels.json'
const IPTV_HEADERS = {
  'accept':          '*/*',
  'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'dnt':             '1',
  'referer':         'https://iptv-eldbert.xyz/iptv/',
  'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
}

const FIFA_GROUPS = new Set(['FIFA World Cup', 'World Cup 2026 LIVE'])

// Wrap stream URL through iptv-eldbert's own proxy so tokens + headers are handled correctly
const IPTV_PROXY = 'https://iptv-eldbert.xyz/proxy'
function proxyStreamUrl(url) {
  return `${IPTV_PROXY}?url=${encodeURIComponent(url)}`
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

let _id = 500
function mapChannel(ch) {
  return {
    id:          _id++,
    key:         `iptv_${slugify(ch.name)}`,
    name:        ch.name.replace(/^⚽\s*/, ''),
    match:       'FIFA World Cup 2026 — Live',
    logo:        'FIFA',
    badge:       'HD',
    language:    'English',
    description: `FIFA World Cup 2026 — ${ch.name.replace(/^⚽\s*/, '')}`,
    url:         proxyStreamUrl(ch.url),
    reqHeaders:  { referer: 'https://iptv-eldbert.xyz/iptv/' },
    keyId:       null,
    drmKey:      null,
  }
}

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  try {
    const upstream = await fetch(`${IPTV_URL}?v=${Date.now()}`, {
      headers: IPTV_HEADERS,
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return res.status(upstream.status).end(`Upstream error: ${upstream.status}`)
    }

    const data = await upstream.json()
    _id = 500

    const channels = []

    for (const item of data) {
      // Flat channel: { name, url, group, status, logo }
      if (item.url && item.group && FIFA_GROUPS.has(item.group)) {
        if (item.status === 'alive' || !item.status) {
          channels.push(mapChannel(item))
        }
        continue
      }
      // Category object: { category, channels: [...] }
      if (item.channels && item.category?.match(/FIFA|World Cup/i)) {
        for (const ch of item.channels) {
          if (ch.url) channels.push(mapChannel(ch))
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(channels)
  } catch (err) {
    res.status(502).end(`Proxy error: ${err.message}`)
  }
}
