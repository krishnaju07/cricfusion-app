// Vercel Edge Function — transparent proxy for Sony LIV / Akamai CDN.
// Adds CORS headers and rewrites manifest content so HLS.js segment
// fetches also go through this proxy. Injects the hdnea token into
// relative variant/segment URLs so Akamai auth passes on every request.

export const config = { runtime: 'edge' }

function proxyAkamaiUrl(url, hdnea) {
  let out = url
  if (out.startsWith('https://sonydaimenew.akamaized.net/')) {
    out = '/sl-cdn/' + out.slice('https://sonydaimenew.akamaized.net/'.length)
  }
  if (hdnea && !out.includes('hdnea=')) {
    out += out.includes('?') ? `&hdnea=${hdnea}` : `?hdnea=${hdnea}`
  }
  return out
}

function rewriteManifest(text, hdnea) {
  // Rewrite plain URL lines (variant playlists, segments)
  let out = text.replace(/^(?!#|\s*$)(.+)$/gm, (line) => proxyAkamaiUrl(line.trim(), hdnea))

  // Rewrite URI="..." inside #EXT-X-KEY and #EXT-X-MEDIA tags (AES key URLs)
  out = out.replace(/(URI=")([^"]+)(")/g, (_, open, uri, close) =>
    `${open}${proxyAkamaiUrl(uri, hdnea)}${close}`
  )

  return out
}

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''
  const hdnea = url.searchParams.get('hdnea') || ''

  // Strip only 'path=' from the raw query string and pass everything else to Akamai
  // verbatim. Avoid URLSearchParams.toString() — it re-encodes '=' to '%3D' inside
  // token values (hdnea, hdntl) and breaks Akamai's signature validation.
  const rawQs = url.search.slice(1).split('&').filter((p) => !p.startsWith('path=')).join('&')

  const upstream = `https://sonydaimenew.akamaized.net/${path}${rawQs ? '?' + rawQs : ''}`

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
        referer: 'https://www.sonyliv.com/',
        origin: 'https://www.sonyliv.com',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
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
    let text = await upstreamResp.text()
    text = rewriteManifest(text, hdnea)
    return new Response(text, { status: upstreamResp.status, headers: responseHeaders })
  }

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: responseHeaders })
}
