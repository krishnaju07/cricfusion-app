// Proxies ClearKey license requests to la.drmlive.net/tp/sling_ck.
// Shaka sends a POST with a JSON key-request body; this forwards it upstream
// and returns the ClearKey JSON response, bypassing browser CORS restrictions.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'Missing id parameter' })

  let body
  if (req.method === 'POST') {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    body = Buffer.concat(chunks)
  }

  let resp
  try {
    resp = await fetch(`https://la.drmlive.net/tp/sling_ck?id=${encodeURIComponent(id)}`, {
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
