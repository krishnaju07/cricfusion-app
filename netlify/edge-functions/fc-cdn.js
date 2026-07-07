// Netlify Edge Function — transparent proxy for FanCode CDN.
// Runs on Netlify's edge network close to the user.
// Strips cross-origin headers by only forwarding clean browser-like headers.
// Rewrites absolute CDN URLs inside HLS manifests so segment fetches also
// go through this proxy.

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/fc-cdn\//, '')
  const qs = url.search
  const upstream = `https://in-mc-fblive.fancode.com/${path}${qs}`

  let upstreamResp
  try {
    upstreamResp = await fetch(upstream, {
      method: req.method,
      headers: {
        accept: req.headers.get('accept') || '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'none',
        'sec-fetch-storage-access': 'active',
        dnt: '1',
      },
    })
  } catch {
    return new Response('Proxy error', { status: 502 })
  }

  const ct = upstreamResp.headers.get('content-type') || 'application/octet-stream'
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store',
    'Content-Type': ct,
  }

  if (ct.includes('mpegurl') || path.endsWith('.m3u8')) {
    // Rewrite absolute FanCode CDN URLs so HLS.js segment fetches also
    // go through this proxy (same-origin /fc-cdn/ path).
    let text = await upstreamResp.text()
    text = text.replace(/https?:\/\/in-mc-fblive\.fancode\.com\//g, '/fc-cdn/')
    return new Response(text, { status: upstreamResp.status, headers: responseHeaders })
  }

  // Stream binary segments directly — avoids loading full segment into memory
  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: responseHeaders })
}

export const config = { path: '/fc-cdn/*' }
