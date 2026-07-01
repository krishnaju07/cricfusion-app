const GROUP_CATEGORY = {
  sports:        'cricket',
  cricket:       'cricket',
  football:      'football',
  soccer:        'football',
  fifa:          'football',
  tennis:        'tennis',
  basketball:    'basketball',
  'formula 1':   'formula1',
  f1:            'formula1',
  motorsport:    'formula1',
  boxing:        'boxing',
  wrestling:     'boxing',
  kabaddi:       'cricket',
  badminton:     'cricket',
  hockey:        'cricket',
}

function groupToCategory(group) {
  const lower = (group || '').toLowerCase()
  for (const [key, val] of Object.entries(GROUP_CATEGORY)) {
    if (lower.includes(key)) return val
  }
  return 'multi'
}

// Channel-name → category for known Indian sports channels.
// Takes priority over group-title so e.g. "Sony Sports Ten 4" (football)
// isn't lumped into 'cricket' just because group-title="Sports".
const NAME_CATEGORY = [
  // Cricket-primary
  [/star sports (1|2|3|first|select 1)\b/i,    'cricket'],
  [/\bdd sports\b/i,                            'cricket'],
  [/\bsony (sports )?six\b/i,                   'cricket'],
  [/sports\s*18\b/i,                            'cricket'],
  [/\bstar cricket\b/i,                         'cricket'],
  // Football-primary
  [/sony sports ten\s*[45]\b/i,                 'football'],
  [/\bstar sports.*football\b/i,                'football'],
  // Tennis-primary
  [/sony sports ten\s*3\b/i,                    'tennis'],
  [/\beurosport\b/i,                            'tennis'],
  // Formula 1 / Motorsport
  [/star sports select\s*2\b/i,                 'formula1'],
  [/\bf1 tv\b/i,                               'formula1'],
  [/\bmotogp\b/i,                              'formula1'],
  // Boxing
  [/\bboxing tv\b/i,                            'boxing'],
  // Multi-sport (broad nets — keep below specific ones)
  [/sony sports ten\s*[12]\b/i,                 'cricket'],
  [/star sports select\b/i,                     'multi'],
  [/\bespn\b/i,                                'multi'],
]

function nameToCategory(name) {
  for (const [re, cat] of NAME_CATEGORY) {
    if (re.test(name)) return cat
  }
  return null
}

// Inline ClearKey: two 32-char hex strings separated by ':'
// e.g. "14eeabf30c14b7fbf3008c03099ce011:17d2ac8dbc5429bd70af3433aa12158d"
const INLINE_CK_RE = /^[0-9a-f]{32}:[0-9a-f]{32}$/i

// All drmlive.net subdomains that require server-side proxying (JA3/UA checks).
const DRMLIVE_DOMAINS = ['la.drmlive.net', 'mix.drmlive.net', 'bd.drmlive.net', 'now.drmlive.net', 'jt.drmlive.net']
const isDrmlive = (url) => url && DRMLIVE_DOMAINS.some((d) => url.includes(d))

// Parse an M3U text into raw channel objects.
// Handles #EXTINF, #KODIPROP license key/type, #EXTVLCOPT user-agent, and the stream URL line.
// Strips IPTV pipe-header suffixes (|key=val) from URLs.
export function parseM3u(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const channels = []
  let meta = null

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const logo        = line.match(/tvg-logo="([^"]*)"/)?.[1] || ''
      const group       = line.match(/group-title="([^"]*)"/)?.[1] || 'General'
      const tvgId       = line.match(/tvg-id="([^"]*)"/)?.[1] || ''
      const name        = line.match(/,(.+)$/)?.[1]?.trim() || 'Unknown'
      meta = { logo, group, tvgId, name, licenseServer: null, licenseType: null, extvlcUa: null }
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_type=') && meta) {
      meta.licenseType = line.replace('#KODIPROP:inputstream.adaptive.license_type=', '').trim()
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=') && meta) {
      meta.licenseServer = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim()
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=') && meta) {
      meta.extvlcUa = line.replace('#EXTVLCOPT:http-user-agent=', '').trim()
    } else if (!line.startsWith('#') && meta) {
      const url = line.split('|')[0].trim()
      if (url) {
        channels.push({ ...meta, url })
        meta = null
      }
    }
  }

  return channels
}

// Resolve stream URL and DRM config from a parsed M3U channel.
// Returns { url, clearKey, licenseServer, drmSystem, reqHeaders }.
function resolveDrm(ch) {
  const ls = ch.licenseServer || ''
  const lt = (ch.licenseType || '').toLowerCase()

  // 1. Inline KID:KEY clearkey pair (e.g. TSN channels from Amazon IVS)
  if (INLINE_CK_RE.test(ls)) {
    const [keyId, key] = ls.split(':')
    return { url: ch.url, clearKey: { keyId, key }, licenseServer: null, drmSystem: 'clearkey', reqHeaders: null }
  }

  // 2. la.drmlive.net Sling ClearKey license — proxy through /api/drmlive-ck to avoid CORS.
  // Also proxy the MPD fetch through m3u-proxy: browser TLS fingerprint is blocked by
  // la.drmlive.net Cloudflare; our server curl (OpenSSL on Linux/Vercel) is allowed.
  if (ls.includes('la.drmlive.net/tp/sling_ck')) {
    let id = null
    try { id = new URL(ls).searchParams.get('id') } catch {}
    const licenseServer = id ? `/api/drmlive-ck?id=${encodeURIComponent(id)}` : ls
    const url = isDrmlive(ch.url)
      ? `/api/m3u-proxy?url=${encodeURIComponent(ch.url)}`
      : ch.url
    return { url, clearKey: null, licenseServer, drmSystem: 'clearkey', reqHeaders: null }
  }

  // 3. Old Tata Play (tp.drmlive-01.workers.dev) — MPD and license via dedicated proxies
  if (ls.includes('tp.drmlive-01.workers.dev')) {
    let tpId = null
    try { tpId = new URL(ls).searchParams.get('id') } catch {}
    const url = `/api/tp-mpd-proxy?url=${encodeURIComponent(ch.url)}`
    const licenseServer = tpId ? `/api/tp-license?id=${encodeURIComponent(tpId)}` : ls
    return { url, clearKey: null, licenseServer, drmSystem: 'clearkey', reqHeaders: null }
  }

  // 4. Widevine — browser EME; VideoPlayer uses com.widevine.alpha
  if (lt === 'com.widevine.alpha' || lt.includes('widevine')) {
    return { url: ch.url, clearKey: null, licenseServer: ls || null, drmSystem: 'widevine', reqHeaders: null }
  }

  // 5. Generic URL-based ClearKey license server.
  // Proxy both the stream URL and the license server when on drmlive domains —
  // browser TLS fingerprint is blocked (JA3) and CORS headers are absent.
  if (ls && ls.startsWith('http')) {
    const url = isDrmlive(ch.url)
      ? `/api/m3u-proxy?url=${encodeURIComponent(ch.url)}`
      : ch.url
    const licenseServer = isDrmlive(ls)
      ? `/api/drmlive-ck?url=${encodeURIComponent(ls)}`
      : ls
    return { url, clearKey: null, licenseServer, drmSystem: 'clearkey', reqHeaders: null }
  }

  // 6. No DRM / plain HLS — proxy if stream is on a drmlive domain (TiviMate UA required)
  if (isDrmlive(ch.url)) {
    const url = `/api/m3u-proxy?url=${encodeURIComponent(ch.url)}`
    return { url, clearKey: null, licenseServer: null, drmSystem: null, reqHeaders: null }
  }

  // 7. Plain HLS / no DRM
  return { url: ch.url, clearKey: null, licenseServer: null, drmSystem: null, reqHeaders: null }
}

// Map a parsed M3U channel into the CricFusion channel schema.
// keyPrefix  — prefix for the unique channel key (default 'tp' for backward-compat)
// sourceLabel — label shown in channel description (default 'Tata Play')
export function mapM3uChannel(ch, id, { keyPrefix = 'tp', sourceLabel = 'Tata Play' } = {}) {
  const isHd = /\bHD\b/i.test(ch.name)
  const { url, clearKey, licenseServer, drmSystem, reqHeaders } = resolveDrm(ch)
  return {
    id,
    key:          `${keyPrefix}_${ch.tvgId || id}`,
    name:         ch.name,
    category:     nameToCategory(ch.name) || groupToCategory(ch.group),
    currentMatch: ch.name,
    thumbnail:    ch.logo || null,
    logo:         ch.name.replace(/\s+HD\s*$/i, '').slice(0, 4).toUpperCase(),
    isLive:       true,
    viewers:      '—',
    badge:        isHd ? 'HD' : 'SD',
    language:     'Hindi',
    description:  `${ch.name} — ${sourceLabel}`,
    score:        null,
    url,
    clearKey,
    licenseServer,
    drmSystem,
    reqHeaders,
    quality: ['Auto'],
  }
}
