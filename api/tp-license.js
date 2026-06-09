// ClearKey license server proxy for Tata Play.
// Shaka sends: POST /api/tp-license?id={channelId} with {"kids": ["<base64url_kid>"], "type": "temporary"}
// We forward to the Cloudflare worker and normalize the response to the exact
// W3C ClearKey JWKS format the browser's EME API requires.

function hexToBase64url(hex) {
  return Buffer.from(hex.replace(/-/g, ''), 'hex')
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Accepts: UUID (with hyphens), raw hex (32 chars), base64/base64url
function toBase64url(str) {
  if (!str) return str
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))
    return hexToBase64url(str)                        // UUID → base64url
  if (/^[0-9a-f]{32,}$/i.test(str))
    return hexToBase64url(str)                        // raw hex → base64url
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') // base64 → base64url
}

// Normalize whatever the worker returns into W3C ClearKey JWKS format.
// Browser rejects update() if kid/k are not proper base64url or if the
// wrapper object is missing — which is error 6008 LICENSE_RESPONSE_REJECTED.
function normalizeJwks(raw, requestedKids) {
  if (!raw || raw === null) return null

  // Already structured as a JWKS keys array
  if (Array.isArray(raw?.keys)) {
    return {
      keys: raw.keys.map((k) => ({
        kty: 'oct',
        k:   toBase64url(k.k   || k.key || k.KEY),
        kid: toBase64url(k.kid || k.KID),
      })).filter((k) => k.k),
      type: 'temporary',
    }
  }

  // Single key object: {k, kid} or {key, kid} or {k} (no kid — use first requested kid)
  const keyVal = raw?.k || raw?.key || raw?.KEY
  if (keyVal) {
    const kid = raw?.kid || raw?.KID || requestedKids?.[0]
    return {
      keys: [{ kty: 'oct', k: toBase64url(keyVal), kid: toBase64url(kid) }],
      type: 'temporary',
    }
  }

  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { id } = req.query
  if (!id) return res.status(400).end('Missing ?id=')

  let body = '{}'
  if (req.method === 'POST') {
    body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })
  }

  let requestedKids = []
  try { requestedKids = JSON.parse(body).kids || [] } catch {}

  try {
    const r = await fetch(`https://tp.drmlive-01.workers.dev?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin':  'https://watch.tataplay.com',
        'Referer': 'https://watch.tataplay.com/',
        'Content-Type': 'application/json',
        'Accept':  'application/json',
      },
      body,
    })
    if (!r.ok) return res.status(r.status).end('License worker error')

    const raw = await r.json()
    console.log('[tp-license] worker raw:', JSON.stringify(raw))

    if (raw === null) return res.status(404).end('Key not found for this channel')

    const jwks = normalizeJwks(raw, requestedKids)
    if (!jwks || !jwks.keys.length)
      return res.status(502).end('Could not normalize license response')

    console.log('[tp-license] normalized jwks:', JSON.stringify(jwks))
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(jwks)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
