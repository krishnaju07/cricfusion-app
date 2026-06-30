import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

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

  // Activation endpoint returns MPD/XML, not M3U — skip the #EXTM3U validation check.
  const isActivation = targetUrl.includes('actchaljabsdk')

  if (useCurl) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '-s', '-L',
        '-A', 'TiviMate/4.6.0 (Android)',
        '--max-time', '10',
        '--connect-timeout', '6',
        targetUrl,
      ], { maxBuffer: 10 * 1024 * 1024 })

      if (!isActivation && (!stdout || !stdout.includes('#EXTM3U'))) {
        return res.status(502).end('Playlist server returned unexpected content')
      }

      res.setHeader('Content-Type', isActivation ? 'application/dash+xml' : 'audio/x-mpegurl')
      return res.status(200).send(stdout || '')
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
