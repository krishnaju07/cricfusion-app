// Full port of get-mpd.php:
// 1. Calls Tata Play content API with subscriber auth to get encrypted MPD URL
// 2. Decrypts URL via AES-128-ECB
// 3. Follows ALL Akamai CDN redirects (redirect:follow) to get final URL + MPD
// 4. Extracts Widevine PSSH → calls tp.secure-kid.workers.dev for KID
// 5. Rewrites manifest: strips Widevine/PlayReady, injects ClearKey system ID
import crypto from 'crypto'

const UA    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
const WATCH = 'https://watch.tataplay.com'
const AES_KEY = Buffer.from('aesEncryptionKey') // 16 bytes = AES-128

function decryptUrl(encryptedUrl) {
  const clean = encryptedUrl.replace(/#.*$/, '').trim()
  const decoded = Buffer.from(clean, 'base64')
  const decipher = crypto.createDecipheriv('aes-128-ecb', AES_KEY, null)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(decoded), decipher.final()]).toString()
}

// Returns { mpdUrl, mpdText } — fetches the MPD exactly once to avoid
// consuming a single-use Akamai token on a dry redirect-only request.
async function fetchMpd(id, subscriberId, token) {
  const contentApi = `https://tb.tapi.videoready.tv/content-detail/api/partner/cdn/player/details/chotiluli/${id}`
  const r = await fetch(contentApi, {
    headers: { 'Authorization': `Bearer ${token}`, 'subscriberId': subscriberId },
  })
  const data = await r.json()
  console.log('[tp-mpd] content API data keys:', JSON.stringify(Object.keys(data?.data || {})))
  console.log('[tp-mpd] content API data:', JSON.stringify(data?.data))
  if (!data.data?.dashPlayreadyPlayUrl) throw new Error('dashPlayreadyPlayUrl not found')

  let url = decryptUrl(data.data.dashPlayreadyPlayUrl)
  url = url.replace('bpaita', 'bpaicatchupta').replace('manifest', 'Manifest')

  // Follow all CDN redirects automatically. response.url is the final URL
  // (with full ?hdntl=... and any other Akamai parameters intact — old code
  // split on & which stripped required params and caused 403 on segments).
  const mpdResp = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Referer': 'https://watch.tataplay.com/',
      'Origin': 'https://watch.tataplay.com',
    },
  })
  if (!mpdResp.ok) throw new Error(`CDN fetch failed: ${mpdResp.status}`)

  return { mpdUrl: mpdResp.url || url, mpdText: await mpdResp.text() }
}

async function extractPssh(mpdText) {
  const wvMatch = mpdText.match(/schemeIdUri="[^"]*edef8ba9[^"]*"[^>]*>[\s\S]*?<cenc:pssh[^>]*>([\s\S]*?)<\/cenc:pssh>/i)
  const wvPssh = wvMatch?.[1]?.trim() || null
  const prMatch = mpdText.match(/schemeIdUri="[^"]*9a04f079[^"]*"[^>]*>[\s\S]*?<cenc:pssh[^>]*>([\s\S]*?)<\/cenc:pssh>/i)
  const prPssh = prMatch?.[1]?.trim() || null

  // Primary: KID already present in the MPD (mp4protection cenc:default_KID)
  const directKid = mpdText.match(/cenc:default_KID="([0-9a-f-]{36})"/i)?.[1]
  if (directKid) return { wvPssh, prPssh, kid: directKid }

  if (!wvPssh) return { wvPssh, prPssh, kid: null }

  // Fallback: derive KID from Widevine PSSH via secure-kid worker
  try {
    const psshHex = Buffer.from(wvPssh, 'base64').toString('hex')
    const kidResp = await fetch('https://tp.secure-kid.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pssh: psshHex }),
    })
    const kidData = await kidResp.json()
    const h = kidData.encryptedKID
    if (!h) return { wvPssh, prPssh, kid: null }
    const kid = [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-')
    return { wvPssh, prPssh, kid }
  } catch {
    return { wvPssh, prPssh, kid: null }
  }
}

function rewriteMpd(text, baseUrl, pssh) {
  // Rewrite only SegmentTemplate initialization/media attributes that start with
  // a relative "dash/" prefix. Using a global /\bdash\//g regex was corrupting
  // the <BaseURL> element's ?hdnea=...~acl=.../output/dash/ query string.
  let out = text.replace(/((?:initialization|media)=")dash\//g, `$1${baseUrl}/dash/`)

  if (!pssh) return out

  // Remove Widevine (edef8ba9) and PlayReady (9a04f079) ContentProtection elements.
  // Shaka prefers Widevine when present and throws NO_LICENSE_SERVER_GIVEN (6012)
  // since we only support ClearKey. Removing them forces Shaka to use our ClearKey entry.
  out = out.replace(/<ContentProtection[^>]*(?:edef8ba9|9a04f079)[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')

  // Only inject cenc:default_KID into mp4protection if not already present
  if (pssh.kid && !text.includes('cenc:default_KID')) {
    out = out.replace('mp4protection:2011"', `mp4protection:2011" cenc:default_KID="${pssh.kid}"`)
  }

  // Inject ClearKey ContentProtection before EVERY mp4protection element so that
  // all AdaptationSets (audio + video) declare the ClearKey system. Using only
  // .replace() (first match) leaves the video AdaptationSet without ClearKey,
  // causing Shaka to fall back to Widevine (error 6012).
  if (pssh.kid) {
    const ck = `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${pssh.kid}</cenc:default_KID></ContentProtection>\n        `
    out = out.replace(/<ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection/g,
      `${ck}<ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection`)
  }

  return out
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { id, sub: subscriberId, tok: token } = req.query
  if (!id)             return res.status(400).end('Missing ?id=')
  if (!subscriberId)   return res.status(401).end('Missing ?sub=')
  if (!token)          return res.status(401).end('Missing ?tok=')

  try {
    const { mpdUrl, mpdText } = await fetchMpd(id, subscriberId, token)

    // Strip query string before computing base — mpdUrl may end with ?hdnea=...~acl=.../dash/
    // causing lastIndexOf('/') to land inside the query string and produce a garbage baseUrl.
    const urlPath = mpdUrl.split('?')[0]
    const baseUrl = urlPath.substring(0, urlPath.lastIndexOf('/'))
    const pssh = await extractPssh(mpdText)
    const processed = rewriteMpd(mpdText, baseUrl, pssh)

    res.setHeader('Content-Type', 'application/dash+xml')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    return res.status(200).send(processed)
  } catch (e) {
    return res.status(500).end(`tp-mpd error: ${e.message}`)
  }
}
