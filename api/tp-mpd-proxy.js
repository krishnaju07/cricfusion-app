// Fetches a Tata Play MPD from the user's PHP proxy and injects a ClearKey
// ContentProtection element so Shaka can select org.w3.clearkey DRM.
// The MPD from get-mpd.php already has cenc:default_KID + Widevine PSSH.
// We keep those and add the ClearKey system ID alongside them.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const rawUrl = req.query.url
  if (!rawUrl) return res.status(400).end('Missing ?url=')

  let targetUrl
  try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl) }
  catch { return res.status(400).end('Invalid URL') }

  try {
    const r = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':  'application/dash+xml, */*',
        'Referer': 'https://watch.tataplay.com/',
        'Origin':  'https://watch.tataplay.com',
      },
    })
    if (!r.ok) return res.status(r.status).end('Upstream MPD fetch failed')

    let text = await r.text()

    // Extract KID before stripping (any namespace prefix, optional curly braces)
    const kidMatch = text.match(/default_KID="\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?"/i)
    const kid = kidMatch ? kidMatch[1].toLowerCase() : null
    if (!kid) console.error('[tp-mpd-proxy] KID not found in MPD:', targetUrl.split('?')[0])

    // Strip Widevine (edef8ba9) and PlayReady (9a04f079).
    // Leaving Widevine PSSH alongside ClearKey causes Shaka error 6012 —
    // keySystemsMapping redirects to ClearKey but passes Widevine protobuf as init data.
    text = text.replace(/<ContentProtection[^>]*edef8ba9[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
    text = text.replace(/<ContentProtection[^>]*9a04f079[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')

    if (kid) {
      const ck = `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${kid}</cenc:default_KID></ContentProtection>`
      if (text.includes('<ContentProtection')) {
        text = text.replace('<ContentProtection', ck + '\n        <ContentProtection')
      } else {
        text = text.replace('<Representation', ck + '\n        <Representation')
      }
    }

    res.setHeader('Content-Type', 'application/dash+xml')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    return res.status(200).send(text)
  } catch (e) {
    return res.status(502).end('tp-mpd-proxy error: ' + e.message)
  }
}
