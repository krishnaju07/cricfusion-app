// Vercel Edge Function — transparent proxy for dishmt.slivcdn.com (Sony LIV Akamai CDN).
// Akamai's HLS response sends Access-Control-Allow-Methods/Headers but no
// Access-Control-Allow-Origin, so hls.js's cross-origin fetch/XHR gets blocked
// by the browser. Proxying same-origin and adding ACAO fixes it.
// The hdntl auth token is embedded as literal path/query segments containing
// '=', '~', '/' — must be forwarded verbatim, never re-encoded.

export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''

  // Preserve the raw query string verbatim — re-stringifying via
  // URLSearchParams re-encodes '=' inside the hdntl/hmac value, breaking
  // Akamai's token validation.
  const rawQs = url.search.slice(1).split('&')
    .filter((p) => !p.startsWith('path='))
    .join('&')

  const upstream = `https://dishmt.slivcdn.com/${path}${rawQs ? '?' + rawQs : ''}`

  let upstreamResp
  try {
    upstreamResp = await fetch(upstream, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        dnt: '1',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'none',
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
    // Rewrite the absolute AES key URI so it also routes through this proxy
    // (segment .ts URLs are already relative, so they inherit /dm-cdn/ for free).
    const text = (await upstreamResp.text())
      .replace(/https?:\/\/dishmt\.slivcdn\.com\//g, '/dm-cdn/')
    return new Response(text, { status: upstreamResp.status, headers: responseHeaders })
  }

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: responseHeaders })
}
