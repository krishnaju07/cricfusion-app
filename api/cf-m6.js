// Vercel serverless — M6 France DASH manifest proxy.
// Fetches the M6 MPD with the required Origin header (6cloud.fr CDN is origin-restricted).
// Referer-locked: only cricfusion.vercel.app and localhost may call this.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173'
]

const M6_MPD = 'https://origin-m6web.live.6cloud.fr/out/v1/6play/6play-m6/cmaf_cenc00/dash-short-hd.mpd'

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  try {
    const upstream = await fetch(M6_MPD, {
      headers: {
        'accept':             '*/*',
        'accept-language':    'en-GB,en-US;q=0.9,en;q=0.8',
        'dnt':                '1',
        'origin':             'https://footsterss.pages.dev',
        'priority':           'u=1, i',
        'sec-ch-ua':          '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile':   '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest':     'empty',
        'sec-fetch-mode':     'cors',
        'sec-fetch-site':     'cross-site',
        'user-agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      },
    })

    if (!upstream.ok) {
      return res.status(upstream.status).end(`Upstream error: ${upstream.status}`)
    }

    const body = await upstream.text()

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('Content-Type', 'application/dash+xml')
    res.status(200).send(body)
  } catch (err) {
    res.status(502).end(`Proxy error: ${err.message}`)
  }
}
