// Vercel serverless function — server-side proxy for dynamic channel API.
// The browser/SW calling this avoids CORS blocks on the upstream Vercel app.

const JAPIWEB_IDS = ['s1', 's2', 's3', 's4', 's5']
const WILLOW_ALT_IDS = ['e10s3']

export default async function handler(req, res) {
  const id = req.query.id
  if (!id) return res.status(400).end('Missing id')

  const isJapi = JAPIWEB_IDS.includes(id)
  const isWillowAlt = WILLOW_ALT_IDS.includes(id)
  const isAll = id === 'all'
  const upstream = isJapi
    ? `https://japiweb.vercel.app/api/main?id=${encodeURIComponent(id)}`
    : isWillowAlt
      ? `https://mainnn-omega.vercel.app?id=${encodeURIComponent(id)}`
      : isAll
        ? 'https://newwwwapiiiiii.vercel.app/main'
        : `https://newwwwapiiiiii.vercel.app/main?id=${encodeURIComponent(id)}`

  const headers = isJapi
    ? {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://cricpulse.pages.dev',
        'Referer': 'https://cricpulse.pages.dev',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Sec-CH-UA': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"macOS"',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      }
    : {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://cricpulse.pages.dev',
        'Referer': 'https://cricpulse.pages.dev',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      }

  let resp
  try {
    resp = await fetch(upstream, { headers })
  } catch {
    return res.status(502).end('Upstream error')
  }

  let text = await resp.text()
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (isWillowAlt && resp.ok) {
    // mainnn-omega returns { sid, title, stream, drm: { kid, key } }.
    // Reshape to the { id, name, url, k1, k2 } shape mapDynamicChannel expects.
    try {
      const data = JSON.parse(text)
      text = JSON.stringify({
        id: data.sid ?? id,
        name: data.title,
        url: data.stream,
        k1: data.drm?.kid ?? null,
        k2: data.drm?.key ?? null,
      })
    } catch {}
  }

  res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/json')
  res.status(resp.status).send(text)
}
