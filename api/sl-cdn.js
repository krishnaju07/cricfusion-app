// Vercel Edge Function — transparent proxy for Sony LIV Akamai CDN.
// Runs on Cloudflare edge nodes close to the user (Mumbai for IN users).
// Previous implementation used Node.js Lambda (bom1) but Akamai CDN returns
// 403/219 for AWS data-center IPs. Edge runtime uses Cloudflare nodes which
// have different ASN classification and may be accepted by Akamai.

export const config = { runtime: 'edge' }

function proxyAkamaiUrl(url, hdnea) {
  let out = url
  if (out.startsWith('https://sonydaimenew.akamaized.net/')) {
    out = '/sl-cdn/' + out.slice('https://sonydaimenew.akamaized.net/'.length)
  } else if (out.startsWith('https://sonypartnersdaimenew.akamaized.net/')) {
    out = '/sl-cdn/' + out.slice('https://sonypartnersdaimenew.akamaized.net/'.length)
    out += out.includes('?') ? '&host=p' : '?host=p'
  }
  if (hdnea && !out.includes('hdnea=')) {
    out += out.includes('?') ? `&hdnea=${hdnea}` : `?hdnea=${hdnea}`
  }
  return out
}

function rewriteManifest(text, hdnea) {
  let out = text.replace(/^(?!#|\s*$)(.+)$/gm, (line) => proxyAkamaiUrl(line.trim(), hdnea))
  out = out.replace(/(URI=")([^"]+)(")/g, (_, open, uri, close) =>
    `${open}${proxyAkamaiUrl(uri, hdnea)}${close}`
  )
  return out
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  const url = new URL(req.url)
  const path = url.searchParams.get('path') || ''
  const hdnea = url.searchParams.get('hdnea') || ''
  const akamaiHost = url.searchParams.get('host') === 'p'
    ? 'sonypartnersdaimenew.akamaized.net'
    : 'sonydaimenew.akamaized.net'

  // Preserve raw query string verbatim — URLSearchParams.toString() re-encodes
  // '=' inside hdnea/hmac values as '%3D', breaking Akamai's HMAC validation.
  const rawQs = url.search.slice(1).split('&')
    .filter((p) => !p.startsWith('path=') && !p.startsWith('host='))
    .join('&')

  const upstream = `https://${akamaiHost}/${path}${rawQs ? '?' + rawQs : ''}`

  // Forward the original client IP so Akamai's CDN IP-allowlist check
  // sees the browser's Indian residential IP instead of Cloudflare's IP.
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')

  let upstreamResp
  try {
    upstreamResp = await fetch(upstream, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'dnt': '1',
        'origin': 'https://www.sonyliv.com',
        'referer': 'https://www.sonyliv.com/',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-storage-access': 'active',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        ...(clientIp && { 'x-forwarded-for': clientIp }),
      },
    })
  } catch (err) {
    return new Response('Proxy error: ' + err.message, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  const ct = upstreamResp.headers.get('content-type') || 'application/octet-stream'
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store',
    'Content-Type': ct,
  }

  // Pass non-2xx responses through without rewriting (avoids running
  // rewriteManifest over Akamai's HTML error pages).
  if (!upstreamResp.ok) {
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers: responseHeaders })
  }

  if (ct.includes('mpegurl') || path.endsWith('.m3u8')) {
    const text = rewriteManifest(await upstreamResp.text(), hdnea)
    return new Response(text, { status: upstreamResp.status, headers: responseHeaders })
  }

  return new Response(upstreamResp.body, { status: upstreamResp.status, headers: responseHeaders })
}
