const GROUP_CATEGORY = {
  sports:        'cricket',
  cricket:       'cricket',
  football:      'football',
  soccer:        'football',
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

// Parse an M3U text into raw channel objects.
// Handles #EXTINF, #KODIPROP license key/type, and the stream URL line.
// Strips IPTV pipe-header suffixes (|key=val) from URLs.
export function parseM3u(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const channels = []
  let meta = null

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const logo   = line.match(/tvg-logo="([^"]*)"/)?.[1] || ''
      const group  = line.match(/group-title="([^"]*)"/)?.[1] || 'General'
      const tvgId  = line.match(/tvg-id="([^"]*)"/)?.[1] || ''
      const name   = line.match(/,(.+)$/)?.[1]?.trim() || 'Unknown'
      meta = { logo, group, tvgId, name, licenseServer: null }
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=') && meta) {
      meta.licenseServer = line.replace('#KODIPROP:inputstream.adaptive.license_key=', '').trim()
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

// For Tata Play channels (license URL via tp.drmlive-01.workers.dev):
// - Route the MPD URL through /api/tp-mpd-proxy (adds ClearKey system ID)
// - Route the license URL through /api/tp-license (ClearKey JSON proxy)
// Headers are handled server-side; no reqHeaders needed in browser.
function resolveTpUrls(ch) {
  const ls = ch.licenseServer || ''
  if (!ls.includes('tp.drmlive-01.workers.dev')) {
    return { url: ch.url, licenseServer: ls || null, reqHeaders: null }
  }
  let tpId = null
  try { tpId = new URL(ls).searchParams.get('id') } catch {}

  const url = `/api/tp-mpd-proxy?url=${encodeURIComponent(ch.url)}`
  const licenseServer = tpId ? `/api/tp-license?id=${encodeURIComponent(tpId)}` : ls
  return { url, licenseServer, reqHeaders: null }
}

// Map a parsed M3U channel into the CricFusion channel schema.
export function mapM3uChannel(ch, id) {
  const isHd = /\bHD\b/i.test(ch.name)
  const { url, licenseServer, reqHeaders } = resolveTpUrls(ch)
  return {
    id,
    key:          `tp_${ch.tvgId || id}`,
    name:         ch.name,
    category:     nameToCategory(ch.name) || groupToCategory(ch.group),
    currentMatch: ch.name,
    thumbnail:    ch.logo || null,
    logo:         ch.name.replace(/\s+HD\s*$/i, '').slice(0, 4).toUpperCase(),
    isLive:       true,
    viewers:      '—',
    badge:        isHd ? 'HD' : 'SD',
    language:     'Hindi',
    description:  `${ch.name} — Tata Play`,
    score:        null,
    url,
    clearKey:     null,
    licenseServer,
    reqHeaders,
    quality: ['Auto'],
  }
}
