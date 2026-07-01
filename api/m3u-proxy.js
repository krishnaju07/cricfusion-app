import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Rewrite relative URLs in an M3U8 to absolute so players (hls.js on mobile)
// can fetch segments directly from the origin CDN, not from this proxy path.
function rewriteM3u8Urls(text, baseUrl) {
  if (!text || !text.includes('#EXTM3U')) return text
  let base
  try { base = new URL(baseUrl) } catch { return text }
  const baseDir = base.origin + base.pathname.replace(/\/[^/]*$/, '/')
  return text.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line
    if (trimmed.startsWith('/')) return base.origin + trimmed
    return baseDir + trimmed
  }).join('\n')
}

// Fetches M3U playlists server-side to avoid CORS.
// Special case: la.drmlive.net uses Cloudflare JA3 bot-detection that blocks
// Node.js undici (fetch) but allows curl/OpenSSL, so we shell out to curl for
// that host. All other URLs use regular fetch.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.statusCode = 204
    return res.end()
  }

  const rawUrl = req.query.url
  if (!rawUrl) return res.status(400).end('Missing ?url= parameter')

  let targetUrl
  try {
    targetUrl = decodeURIComponent(rawUrl)
    new URL(targetUrl)
  } catch {
    return res.status(400).end('Invalid URL')
  }

  // drmlive.net requires TiviMate UA — Node.js undici is JA3-blocked, curl uses OpenSSL which is accepted.
  // mix.drmlive.net activation endpoint also requires TiviMate UA (Chrome UA returns 543 Unauthorized).
  const useCurl = targetUrl.includes('la.drmlive.net') ||
                  targetUrl.includes('drmlive.net/tp/') ||
                  targetUrl.includes('mix.drmlive.net')

  // Validate #EXTM3U only for known M3U playlist endpoints.
  // MPD manifests, activation endpoints, and stream manifests skip this check.
  const isM3uPlaylist = targetUrl.includes('/tp/playlist') || /\.(m3u|m3u8)(\?|$)/i.test(targetUrl)
  const isMpd = /\.mpd(\?|$)/i.test(targetUrl) || targetUrl.includes('actchaljabsdk')

  if (useCurl) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '-s', '-L',
        '-A', 'TiviMate/4.6.0 (Android)',
        '--max-time', '10',
        '--connect-timeout', '6',
        targetUrl,
      ], { maxBuffer: 10 * 1024 * 1024 })

      if (isM3uPlaylist && (!stdout || !stdout.includes('#EXTM3U'))) {
        return res.status(502).end('Playlist server returned unexpected content')
      }

      const isStream = !isMpd && !isM3uPlaylist && stdout?.startsWith('#EXTM3U')
      const ct = isMpd ? 'application/dash+xml'
               : (isM3uPlaylist || isStream) ? 'audio/x-mpegurl'
               : 'application/octet-stream'
      // Rewrite relative segment URLs in stream M3U8s so mobile players resolve
      // segments against the origin CDN, not the proxy URL.
      const body = isStream ? rewriteM3u8Urls(stdout, targetUrl) : (stdout || '')
      res.setHeader('Content-Type', ct)
      return res.status(200).send(body)
    } catch (err) {
      return res.status(502).end('Curl fetch failed: ' + err.message)
    }
  }

  // Generic fetch for all other URLs
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'TiviMate/4.6.0 (Android)',
        'Accept': '*/*',
      },
    })
    const text = await resp.text()
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'audio/x-mpegurl')
    res.status(resp.status).send(text)
  } catch (err) {
    return res.status(502).end('Upstream fetch failed: ' + err.message)
  }
}
