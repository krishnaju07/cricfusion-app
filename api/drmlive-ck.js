// Proxies ClearKey license requests to drmlive.net endpoints.
// Shaka sends a POST with a JSON key-request body; this forwards it upstream
// and returns the ClearKey JSON response, bypassing browser CORS + JA3 restrictions.
//
// ?url=<encoded>  — full license server URL (must be on an allowed drmlive domain)
// ?id=<id>        — backward-compat: forwards to la.drmlive.net/tp/sling_ck?id=<id>

const ALLOWED_HOSTS = ['la.drmlive.net', 'mix.drmlive.net', 'now.drmlive.net', 'bd.drmlive.net', 'jt.drmlive.net']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  let licenseUrl
  if (req.query.url) {
    let parsed
    try { parsed = new URL(decodeURIComponent(req.query.url)) } catch {
      return res.status(400).json({ error: 'Invalid url parameter' })
    }
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return res.status(403).json({ error: 'Domain not allowed' })
    }
    licenseUrl = parsed.href
  } else if (req.query.id) {
    licenseUrl = `https://la.drmlive.net/tp/sling_ck?id=${encodeURIComponent(req.query.id)}`
  } else {
    return res.status(400).json({ error: 'Missing url or id parameter' })
  }

  let body
  if (req.method === 'POST') {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    body = Buffer.concat(chunks)
  }

  let resp
  try {
    resp = await fetch(licenseUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Tivimate/4.6.0 Android/12',
        'Content-Type': 'application/json',
      },
      body: body?.length ? body : undefined,
    })
  } catch (err) {
    return res.status(502).end('Upstream fetch failed: ' + err.message)
  }

  const text = await resp.text()
  res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/json')
  res.status(resp.status).send(text)
}
