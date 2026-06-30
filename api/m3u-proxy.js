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

  // la.drmlive.net is bot-protected (JA3 fingerprint check): use curl instead of fetch
  const useCurl = targetUrl.includes('la.drmlive.net') || targetUrl.includes('drmlive.net/tp/')

  if (useCurl) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '-s',
        '-A', 'TiviMate/4.6.0 (Android)',
        '--max-time', '8',
        '--connect-timeout', '5',
        targetUrl,
      ], { maxBuffer: 10 * 1024 * 1024 })

      if (!stdout || !stdout.includes('#EXTM3U')) {
        return res.status(502).end('Playlist server returned unexpected content')
      }

      res.setHeader('Content-Type', 'audio/x-mpegurl')
      return res.status(200).send(stdout)
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
