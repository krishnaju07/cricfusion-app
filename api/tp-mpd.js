// Fetches and rewrites the Tata Play DASH manifest for Widevine playback:
// 1. Calls Tata Play content API with subscriber auth to get encrypted MPD URL
// 2. Decrypts URL via AES-128-ECB (key: "aesEncryptionKey")
// 3. Follows ALL Akamai CDN redirects to get the final URL + MPD text
// 4. Strips PlayReady ContentProtection (Chrome uses Widevine — kept intact)
// 5. Fixes relative "dash/" segment paths to absolute CDN URLs
import crypto from 'crypto'

const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
const AES_KEY = Buffer.from('aesEncryptionKey')

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

// Handles: any namespace prefix, optional curly braces, upper/lowercase hex
function findKid(text) {
  const m = text.match(/default_KID="\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?"/i)
  return m ? m[1].toLowerCase() : null
}

function rewriteMpd(text, baseUrl, channelId) {
  let out = text.replace(/((?:initialization|media)=")dash\//g, `$1${baseUrl}/dash/`)

  // Extract KID before stripping (it lives on the mp4protection:2011 element, not Widevine/PlayReady)
  const kid = findKid(out)
  if (!kid) console.error('[tp-mpd] ch=' + channelId + ' KID not found in MPD — ClearKey injection skipped')

  // Strip PlayReady (9a04f079) and Widevine PSSH (edef8ba9).
  // Widevine PSSH is protobuf; ClearKey needs keyids format — mixing them causes error 6012.
  out = out.replace(/<ContentProtection[^>]*9a04f079[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
  out = out.replace(/<ContentProtection[^>]*edef8ba9[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')

  if (!kid) return out

  const ck = `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${kid}</cenc:default_KID></ContentProtection>`

  // Prefer inserting before the remaining mp4protection:2011 ContentProtection.
  // If none remains (MPD had only Widevine+PlayReady), inject before the first Representation.
  if (out.includes('<ContentProtection')) {
    out = out.replace('<ContentProtection', ck + '\n        <ContentProtection')
  } else {
    out = out.replace('<Representation', ck + '\n        <Representation')
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

    // Strip query string before computing base — mpdUrl ends with ?hdnea=...~acl=.../dash/
    // so lastIndexOf('/') would land inside the query string without this split.
    const urlPath = mpdUrl.split('?')[0]
    const baseUrl = urlPath.substring(0, urlPath.lastIndexOf('/'))
    const processed = rewriteMpd(mpdText, baseUrl, id)

    res.setHeader('Content-Type', 'application/dash+xml')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    return res.status(200).send(processed)
  } catch (e) {
    return res.status(500).end(`tp-mpd error: ${e.message}`)
  }
}
