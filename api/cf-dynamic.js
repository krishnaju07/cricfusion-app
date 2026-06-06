// Vercel serverless function — server-side proxy for dynamic channel API.
// The browser/SW calling this avoids CORS blocks on the upstream Vercel app.

export default async function handler(req, res) {
  const id = req.query.id
  if (!id) return res.status(400).end('Missing id')

  const upstream = `https://newwwwapiiiiii.vercel.app/main?id=${encodeURIComponent(id)}`

  let resp
  try {
    resp = await fetch(upstream, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
  } catch {
    return res.status(502).end('Upstream error')
  }

  const text = await resp.text()
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/json')
  res.status(resp.status).send(text)
}
