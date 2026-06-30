import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Node.js undici (fetch) has a different TLS/JA3 fingerprint than curl/OpenSSL.
// la.drmlive.net Cloudflare bot-check blocks undici but allows curl, so we
// shell out to curl instead of using fetch.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.statusCode = 204
    return res.end()
  }

  try {
    const { stdout } = await execFileAsync('curl', [
      '-s',
      '-A', 'TiviMate/4.6.0 (Android)',
      '--max-time', '8',
      '--connect-timeout', '5',
      'https://la.drmlive.net/tp/playlist',
    ], { maxBuffer: 10 * 1024 * 1024 })

    if (!stdout || !stdout.includes('#EXTM3U')) {
      return res.status(502).end('Playlist server returned unexpected content')
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl')
    res.status(200).send(stdout)
  } catch (err) {
    return res.status(502).end('Fetch failed: ' + err.message)
  }
}
