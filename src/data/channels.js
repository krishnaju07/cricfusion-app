// ── Static channel metadata (display info) ───────────────────────────────────
// Stream URLs + clearKeys are fetched live from the API (always-fresh tokens).
// Only add UI fields here — never hardcode stream URLs.
// localStorage.setItem('cf_dev', '1')
// Display order for API channels
import { FEATURES } from '../config/features'
// Note: the real stream API URL lives only in public/sw.js (server-side proxy).
export const CHANNEL_ORDER = ['EN', 'sidhu', 'EN2', 'sidhu2', 's1', 's2', 's3', 's5']

// Per-channel UI metadata keyed by the API's channel id
const T = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=640&h=360&q=80`

const CHANNEL_META = {
  EN: {
    name: 'Star Sports HD1', logo: 'SS1', category: 'cricket',
    language: 'English', badge: 'HD', viewers: '2.4M',
    thumbnail: T('1540747913346-19212a4b423f'),   // cricket stadium panorama
  },
  sidhu: {
    name: 'Star Sports HD1 Hindi', logo: 'SS1H', category: 'cricket',
    language: 'Hindi', badge: 'HD', viewers: '3.1M',
    thumbnail: T('1531415074968-036ba1b575da'),    // cricket action
  },
  EN2: {
    name: 'Star Sports HD2', logo: 'SS2', category: 'cricket',
    language: 'English', badge: 'HD', viewers: '1.8M',
    thumbnail: T('1624555130581-1d9cca783bc0'),    // cricket pitch
  },
  sidhu2: {
    name: 'Star Sports HD2 Hindi', logo: 'SS2H', category: 'cricket',
    language: 'Hindi', badge: 'HD', viewers: '1.2M',
    thumbnail: T('1595435741984-3a9a5f5ebe68'),    // cricket crowd
  },
  s1: {
    name: 'Sony Ten 1', logo: 'ST1', category: 'cricket',
    language: 'English', badge: 'HD', viewers: '1.6M',
    thumbnail: T('1531415074968-036ba1b575da'),    // cricket action
  },
  s2: {
    name: 'Sony Ten 2', logo: 'ST2', category: 'cricket',
    language: 'English', badge: 'HD', viewers: '980K',
    thumbnail: T('1461896836934-ffe607ba8211'),    // sports stadium
  },
  s3: {
    name: 'Sony Ten 3 Hindi', logo: 'ST3', category: 'cricket',
    language: 'Hindi', badge: 'HD', viewers: '750K',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),    // cricket crowd
  },
  s5: {
    name: 'Sony Ten 5', logo: 'ST5', category: 'cricket',
    language: 'English', badge: 'HD', viewers: '620K',
    thumbnail: T('1568605117036-5fe5e7bab0b7'),    // running track
  },
}

// Convert one API entry → our channel shape
export function mapApiChannel(key, apiData, id) {
  const meta = CHANNEL_META[key] ?? {
    name: apiData.name,
    logo: key.slice(0, 4).toUpperCase(),
    category: 'multi',
    language: 'English',
    badge: 'HD',
    viewers: '1M',
    thumbnail: T('1540747913346-19212a4b423f'),
  }
  return {
    id,
    key,
    name: meta.name,
    category: meta.category,
    currentMatch: `${meta.name} — Live`,
    thumbnail: meta.thumbnail,
    logo: meta.logo,
    isLive: true,
    viewers: meta.viewers,
    badge: meta.badge,
    language: meta.language,
    description: `${meta.name} — Live cricket & sports`,
    score: null,
    url: apiData.streamUrl,
    clearKey: apiData.clearKey ?? null,
    quality: ['Auto', '1080p', '720p', '480p'],
  }
}

// ── Dynamic per-channel API (japiweb.vercel.app/api/main?id=... for s1-s5,
//    newwwwapiiiiii.vercel.app/main?id=... for others) ────────────────────────
// Each entry is fetched individually; SW proxies via /cf-dynamic?id=...
// Response shape: { id, name, Bearer, url, k1, k2 }

export const DYNAMIC_CHANNEL_IDS = ['willow', 'e1s4', 's1', 's2', 's3', 's4', 's5']

const DYNAMIC_META = {
  willow: {
    name: 'Willow TV',       logo: 'WLW',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '750K',
    thumbnail: T('1508098682722-e99c43a406b2'),
  },
  e1s4: {
    name: null,              logo: 'E1S4', category: 'multi',
    language: 'English', badge: 'HD',  viewers: '350K',
    thumbnail: T('1461896836934-ffe607ba8211'),
  },
  s1: {
    name: 'Sony Ten 1',      logo: 'ST1',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '1.6M',
    thumbnail: T('1531415074968-036ba1b575da'),
  },
  s2: {
    name: 'Sony Ten 2',      logo: 'ST2',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '980K',
    thumbnail: T('1461896836934-ffe607ba8211'),
  },
  s3: {
    name: 'Sony Ten 3 Hindi', logo: 'ST3', category: 'cricket',
    language: 'Hindi',   badge: 'HD',  viewers: '750K',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
  },
  s4: {
    name: 'Sony Ten 4',      logo: 'ST4',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '600K',
    thumbnail: T('1531415074968-036ba1b575da'),
  },
  s5: {
    name: 'Sony Ten 5',      logo: 'ST5',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '620K',
    thumbnail: T('1568605117036-5fe5e7bab0b7'),
  },
}

// Convert one per-channel API response → our channel shape.
// id = numeric id to assign (201, 202, …)
export function mapDynamicChannel(apiData, id) {
  const meta = DYNAMIC_META[apiData.id] ?? {}
  const name = meta.name ?? apiData.name
  return {
    id,
    key:          apiData.id,
    name,
    category:     meta.category    ?? 'multi',
    currentMatch: `${name} — Live`,
    thumbnail:    meta.thumbnail   ?? T('1540747913346-19212a4b423f'),
    logo:         meta.logo        ?? apiData.id.slice(0, 4).toUpperCase(),
    isLive:       true,
    viewers:      meta.viewers     ?? '500K',
    badge:        meta.badge       ?? 'HD',
    language:     meta.language    ?? 'English',
    description:  `${name} — Live sports`,
    score:        null,
    url:          apiData.url,
    clearKey:     apiData.k1 && apiData.k2
                    ? { keyId: apiData.k1, key: apiData.k2 }
                    : null,
    quality:      ['Auto', '1080p', '720p', '480p'],
  }
}

// ── FanCode live events (drmlive/fancode-live-events) ────────────────────────
const FC_CATEGORY = {
  Cricket:     'cricket',
  Football:    'football',
  Tennis:      'tennis',
  Basketball:  'basketball',
  MotoGP:      'formula1',
  Motorsports: 'formula1',
  'Formula 1': 'formula1',
  Boxing:      'boxing',
}

// Rewrite FanCode CDN URLs to same-origin /fc-cdn/ so the Edge Function
// proxy handles them (no Origin header from browser, Cloudflare edge IP).
function toFcProxy(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'in-mc-fblive.fancode.com') return `/fc-cdn${u.pathname}${u.search}`
  } catch {}
  return url
}

export function mapFanCodeChannel(match) {
  const primary  = toFcProxy(match.adfree_url || match.dai_url)
  const fallback = null
  return {
    id:           match.match_id,
    key:          `fc_${match.match_id}`,
    name:         match.event_name,
    category:     FC_CATEGORY[match.event_category] || 'multi',
    currentMatch: match.match_name,
    thumbnail:    match.src,
    logo:         'FC',
    isLive:       match.status === 'LIVE',
    viewers:      '—',
    badge:        'HD',
    language:     'English',
    description:  match.title,
    score:        null,
    url:          primary,
    fallbackUrl:  fallback,
    clearKey:     null,
    quality:      ['Auto', '1080p', '720p', '480p'],
  }
}

// ── Sony LIV live events (drmlive/sliv-live-events) ─────────────────────────
const SL_CATEGORY = {
  Cricket:       'cricket',
  Football:      'football',
  Tennis:        'tennis',
  Basketball:    'basketball',
  'Fight Sports': 'boxing',
  MotoGP:        'formula1',
  'Formula 1':   'formula1',
}

const SL_LANG = { ENG: 'English', HIN: 'Hindi', TAM: 'Tamil', TEL: 'Telugu', KAN: 'Kannada', MAR: 'Marathi' }

function toSlProxy(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'sonydaimenew.akamaized.net') return `/sl-cdn${u.pathname}${u.search}`
    if (u.hostname === 'sonypartnersdaimenew.akamaized.net') {
      const qs = u.search ? `${u.search}&host=p` : '?host=p'
      return `/sl-cdn${u.pathname}${qs}`
    }
  } catch {}
  return url
}

function sonyLivLogo(channel) {
  const m = channel?.match(/Ten\s*(\d+)/i)
  if (m) return `SST${m[1]}`
  const m2 = channel?.match(/(?:Sports|LIV)\s*(\d+)/i)
  if (m2) return `SL${m2[1]}`
  return (channel || 'SLV').slice(0, 4).toUpperCase()
}

export function mapSonyLivChannel(match, id) {
  const lang = match.audioLanguageName || 'ENG'
  const originalUrl = match.dai_url || match.pub_url || match.video_url
  const url  = toSlProxy(originalUrl)
  const baseId = (match.contentId || '').split('_')[0]
  const sonyLivUrl = baseId
    ? `https://www.sonyliv.com/live/${baseId}`
    : 'https://www.sonyliv.com/sports'
  return {
    id,
    key:          `sl_${match.contentId}`,
    name:         match.event_name,
    category:     SL_CATEGORY[match.event_category] || 'multi',
    currentMatch: match.match_name,
    thumbnail:    match.src,
    logo:         sonyLivLogo(match.broadcast_channel),
    isLive:       !!match.isLive,
    viewers:      '—',
    badge:        'HD',
    language:     SL_LANG[lang] || lang,
    description:  `${match.event_name} — ${match.broadcast_channel || 'Sony LIV'}`,
    score:        null,
    url,
    originalUrl,  // direct Akamai URL — used by Safari native HLS (no CORS restriction)
    clearKey:     null,
    quality:      ['Auto', '1080p', '720p', '480p'],
    sonyLivUrl,
  }
}

// ── Star / Sony Sports (sayan-json-4 sports.json) ────────────────────────────
// Live-fetched JSON of Jio CDN DASH streams + ClearKey + short-lived __hdnea__
// cookie token. Same shape the existing player already handles (DASH + ClearKey
// + token re-appended on segments). Tokens expire in hours → always fetch live.
const STARSONY_LOGO = (name) => {
  const m = name.match(/Star Sports\s*(\d+)/i)
  if (m) return `SS${m[1]}`
  const s = name.match(/Sony.*?(\d+)/i)
  if (s) return `SL${s[1]}`
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase()
}
function starsonyLanguage(name) {
  if (/hindi/i.test(name))   return 'Hindi'
  if (/tamil/i.test(name))   return 'Tamil'
  if (/telugu/i.test(name))  return 'Telugu'
  if (/kannada/i.test(name)) return 'Kannada'
  if (/marathi/i.test(name)) return 'Marathi'
  if (/bangla|bengali/i.test(name)) return 'Bengali'
  return 'English'
}

export function mapStarSonyChannel(c, id) {
  if (!c?.stream_url) return null
  // Append the __hdnea__ token to the manifest URL; the player re-appends it on
  // each segment request via extractToken().
  const token = (c.cookie || '').trim()
  const url = token
    ? `${c.stream_url}${c.stream_url.includes('?') ? '&' : '?'}${token}`
    : c.stream_url
  return {
    id,
    key:          `starsony_${c.id}`,
    name:         c.name?.trim() || c.id,
    category:     'starsony',
    currentMatch: `${c.name?.trim() || c.id} — Live`,
    thumbnail:    T('1540747913346-19212a4b423f'),
    logo:         STARSONY_LOGO(c.name || c.id),
    isLive:       true,
    viewers:      '—',
    badge:        /\bHD\b/i.test(c.name || '') ? 'HD' : 'SD',
    language:     starsonyLanguage(c.name || ''),
    description:  `${c.name?.trim() || c.id} — Live Sports`,
    score:        null,
    url,
    clearKey:     c.key_id && c.key ? { keyId: c.key_id, key: c.key } : null,
    quality:      ['Auto', '1080p', '720p', '480p'],
  }
}

// Amazon IVS / Akamai region path prefixes that indicate geo-restriction.
// e.g. /gru-nitro/ = São Paulo (Brazil), /fra-nitro/ = Frankfurt (Germany).
const GEO_NITRO = { gru: 'BR', fra: 'DE' }

// Auto-detect VPN requirement from stream URL.
// Unwraps iptv-eldbert proxy URLs so the real CDN host/path can be inspected.
// Explicit s.vpn field always wins over auto-detection.
function detectVpn(url) {
  if (!url) return null
  let target = url
  try {
    // iptv-eldbert wraps real URL as ?url= — decode it first
    const parsed = new URL(url)
    if (parsed.hostname === 'iptv-eldbert.xyz' && parsed.searchParams.has('url')) {
      target = parsed.searchParams.get('url')
    }
  } catch { return null }
  try {
    const { hostname: h, pathname: p } = new URL(target)
    // Hostname-based rules
    if (h.includes('t-online.de'))                       return 'DE'
    if (h.endsWith('.ors.at') || h.endsWith('.orf.at'))  return 'AT'
    if (h.endsWith('.vrtcdn.be') || h.endsWith('.rtbf.be') || h.includes('redbee.live')) return 'BE'
    if (h.endsWith('.antik.sk'))                         return 'SK'
    if (h.includes('m6web') || h.endsWith('.6cloud.fr')) return 'FR'
    if (h.endsWith('.rte.ie'))                           return 'IE'
    if (h.endsWith('.trt.com.tr'))                       return 'TR'
    if (h.endsWith('.tvp.pl'))                           return 'PL'
    if (h.endsWith('.svt.se'))                           return 'SE'
    if (h.endsWith('.nrk.no'))                           return 'NO'
    // Path-based: Amazon IVS region prefix (e.g. /gru-nitro/ = Brazil)
    for (const [code, country] of Object.entries(GEO_NITRO)) {
      if (p.startsWith(`/${code}-`) || p.includes(`/${code}-nitro/`)) return country
    }
  } catch { /* invalid URL */ }
  return null
}

// ── FIFA 2026 channels — fetched at runtime via /cf-fifa (server-side) ───────
// URLs and clearKeys are NOT in this bundle. See api/cf-fifa.js.
export function mapFifaChannel(s) {
  return {
    id:           s.id,
    key:          s.key,
    name:         s.name,
    category:     'fifa2026',
    currentMatch: s.match,
    thumbnail:    T('1574629810360-7efbbe195018'),
    logo:         s.logo,
    isLive:       true,
    viewers:      '—',
    badge:        s.badge ?? 'HD',
    language:     s.language,
    description:  s.description,
    score:        null,
    url:          s.url,
    vpn:          s.vpn || detectVpn(s.url),
    mimeType:     s.mimeType || undefined,
    reqHeaders:   s.reqHeaders || null,
    clearKey:     s.keyId ? { keyId: s.keyId, key: s.drmKey } : null,
    clearKeys:    s.keys  ? Object.fromEntries(s.keys.map((k) => [k.keyId, k.drmKey]))
                          : s.keyId ? { [s.keyId]: s.drmKey } : null,
    quality:      ['Auto', '1080p', '720p', '480p'],
  }
}

export const STATIC_CHANNELS = [
{
    id: 143,
    key: 'zee5cricket',
    name: 'Zee5 Cricket Live',
    category: 'zee5',
    currentMatch: 'POR vs UZB — Live on Zee5',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'ZEE',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'Zee5 Cricket — Live',
    score: null,
    url: 'https://falcon-en-conn.zee5.com/hls/live/2125523/POR-vs-UZB-23-con_ENG/index-connected.m3u8?hdnts=st=1782234924~exp=1782249324~acl=/hls/live/2125523/POR-vs-UZB-23-con_ENG/index-connected.m3u8*~id=0-1-6z5974844_B3A3B898-6E6D-4398-B06D-57183B24F343~hmac=f5cd539141708babf790a80bf02d409f082e8a44164c041b36b257c223777792&req_id=cf2f832b-bd46-46dc-b208-1c1da2f4e621',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 152,
    key: 'StarSportsHD1',
    name: 'Star Sports HD1',
    category: 'cricket',
    currentMatch: 'Star Sports HD1 — Live',
    thumbnail: T('1540747913346-19212a4b423f'),
    logo: 'SS1',
    isLive: true,
    viewers: '2.4M',
    badge: 'HD',
    language: 'English',
    description: 'Star Sports HD1 — Live Cricket',
    score: null,
    url: 'https://jiotvpllive.cdn.jio.com/bpk-tv/Star_Sports_HD1_BTS/WDVLive/index.mpd?__hdnea__=st=1782617440~exp=1782639040~acl=/bpk-tv/Star_Sports_HD1_BTS/WDVLive/*~hmac=572a2de927ed6a02f5b0e8a4d5d44f2b5be93b78030a16377aabd47f5ff20a05',
    clearKey: { keyId: '965dc2ddb1d85138ad787999a7f30ca5', key: '859695076e67fe961836b564db6d689c' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 153,
    key: 'StarSportsHD2',
    name: 'Star Sports HD2',
    category: 'cricket',
    currentMatch: 'Star Sports HD2 — Live',
    thumbnail: T('1624555130581-1d9cca783bc0'),
    logo: 'SS2',
    isLive: true,
    viewers: '1.8M',
    badge: 'HD',
    language: 'English',
    description: 'Star Sports HD2 — Live Cricket',
    score: null,
    url: 'https://jiotvpllive.cdn.jio.com/bpk-tv/Star_Sports_HD2_BTS/WDVLive/index.mpd?__hdnea__=st=1782617441~exp=1782639041~acl=/bpk-tv/Star_Sports_HD2_BTS/WDVLive/*~hmac=5d7a899064da1ee96389de5f80bdc21aadac5ad5251d9c552bbd6edc26a24a2f',
    clearKey: { keyId: '9457eb90129456fa8ea95e10ba4ac51e', key: 'e620a970cea474c491ac78ae71a4d764' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 118,
    key: 'prime',
    name: 'Prime video 1080p50',
    category: 'cricket',
    currentMatch: 'Prime video 1080p50 — Live',
    thumbnail: T('1540747913346-19212a4b423f'),
    logo: 'PRIME',
    isLive: true,
    viewers: '—',
    badge: '1080p',
    language: 'English',
    description: 'Prime video 1080p50 — Live',
    score: null,
    url: 'https://ABGURYQAAAAAAAAMDWLAPGWRF4XPJ.bia-cf.live.pv-cdn.net/sin-nitro/live/clients/dash/enc/87d0tehlad/out/v1/403835568f5b4e3ca2d201cc88b594ee/cenc.mpd',
    clearKey: { keyId: 'ee0c99be51120d109657df5229b48b01', key: '6f0cc18e09de8ec73414bb2209d6c63b' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 119,
    key: 'fussball1',
    name: 'Fussball 1 HD',
    category: 'football',
    currentMatch: 'Fussball 1 HD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB1',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'German',
    description: 'Fussball 1 HD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01037_FUSSBALLTV1_hd/DASH/index.mpd',
    clearKey: { keyId: '1cb20afcd9d979c833cfd208c7d3eeb2', key: 'fef0c15b4a523370892edd5e4133c269' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 120,
    key: 'fussball2',
    name: 'Fussball 2 HD',
    category: 'football',
    currentMatch: 'Fussball 2 HD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB2',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'German',
    description: 'Fussball 2 HD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01064_FUSSBALLTV2_hd/DASH/index.mpd',
    clearKey: { keyId: '1889c6c8cdf57aa3bc90bb976ca6cbdc', key: '48ef3649d9076965b70e79e58b0028ef' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 121,
    key: 'fussball3',
    name: 'Fussball 3 HD',
    category: 'football',
    currentMatch: 'Fussball 3 HD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB3',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'German',
    description: 'Fussball 3 HD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01065_FUSSBALLTV3_hd/DASH/index.mpd',
    clearKey: { keyId: '16f590cc66a7b75be5bec7d7f9518a64', key: '514ba9039f96dd18dc53f9c20f09f4eb' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 122,
    key: 'fussball1uhd',
    name: 'Fussball 1 UHD',
    category: 'football',
    currentMatch: 'Fussball 1 UHD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB1U',
    isLive: true,
    viewers: '—',
    badge: '4K',
    language: 'German',
    description: 'Fussball 1 UHD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01037_FUSSBALLTV1_uhd/DASH/index.mpd',
    clearKey: { keyId: '1f09d5788fbbb03a053d03cc731f31a9', key: 'd493d5a70c793362324638f61d1726ac' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 123,
    key: 'fussball2uhd',
    name: 'Fussball 2 UHD',
    category: 'football',
    currentMatch: 'Fussball 2 UHD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB2U',
    isLive: true,
    viewers: '—',
    badge: '4K',
    language: 'German',
    description: 'Fussball 2 UHD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01064_FUSSBALLTV2_uhd/DASH/index.mpd',
    clearKey: { keyId: '1b98a0f2de7784c6e132942385a089f3', key: '546eae09a8d81c498dfd08532dcd68a5' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 124,
    key: 'fussball3uhd',
    name: 'Fussball 3 UHD',
    category: 'football',
    currentMatch: 'Fussball 3 UHD — Live',
    thumbnail: T('1574629810360-7efbbe195018'),
    logo: 'FB3U',
    isLive: true,
    viewers: '—',
    badge: '4K',
    language: 'German',
    description: 'Fussball 3 UHD — Live Football',
    score: null,
    url: '/cf-geo/svc45.main.sl.t-online.de/bpk-tv/KID01065_FUSSBALLTV3_uhd/DASH/index.mpd',
    clearKey: { keyId: '1e7d99c0433399f6149e33860a755824', key: '58defdfcb6ec5473905cbae6a7e6752c' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 125,
    key: 'foxusa',
    name: 'Fox Sports English 720p',
    category: 'football',
    currentMatch: 'Fox Sports English 720p — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'FOXT',
    isLive: true,
    viewers: '—',
    badge: '720p',
    language: 'English',
    description: 'Fox Sports English 720p — Live',
    score: null,
    url: 'https://abgfgo7aaaaaaaammo4qlji7ci5df.ta.bia-cf.live.pv-cdn.net/pdx-nitro/live/clients/dash/enc/ap5wz1ofsp/out/v1/7fa6feef143747beaa186ebb6dfb2532/cenc.mpd',
    clearKey: { keyId: 'c620c93c60c04999eb9ddc28ecfb70a8', key: 'e76a709c251313190e76cb3c3d3a5824' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 126,
    key: 'telemundo2',
    name: 'Telemundo Spanish',
    category: 'fifa2026',
    currentMatch: 'Telemundo Spanish — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TLM2',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'Spanish',
    description: 'Telemundo Spanish — Live',
    score: null,
    url: 'https://live-oneapp-prd-news.akamaized.net/Content/CMAF_OL2-CTR-4s/Live/channel(WSNS)/master.mpd',
    clearKey: { keyId: '7d6bb9f86e133e4cb33440b493b6b672', key: '584ad285dcb9e7d42cf3e93f1cc3fe11' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 127,
    key: 'unite8sports1hd',
    name: 'English Unite8 Sports 1HD',
    category: 'multi',
    currentMatch: 'English Unite8 Sports 1HD — Live',
    thumbnail: T('1461896836934-ffe607ba8211'),
    logo: 'U8S1',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'English Unite8 Sports 1HD — Live Sports',
    score: null,
    url: 'https://sundirectgo-live.pc.cdn.bitgravity.com/svchd18/dth.mpd',
    clearKey: { keyId: 'e2d998ab1361a95bdb70f10e75ff51a1', key: 'e680b004bd19c96f759c69dc4993603c' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 128,
    key: 'unite8sports2hd',
    name: 'HINDI Unite8 Sports 2HD',
    category: 'multi',
    currentMatch: 'HINDI Unite8 Sports 2HD — Live',
    thumbnail: T('1461896836934-ffe607ba8211'),
    logo: 'U8S2',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'Hindi',
    description: 'HINDI Unite8 Sports 2HD — Live Sports',
    score: null,
    url: 'https://sundirectgo-live.pc.cdn.bitgravity.com/svchd14/dth.mpd',
    clearKey: { keyId: 'ee4a1fb5724d964ab540c3d9ddce98e1', key: '1b56da7481975507ab506a970c419b8d' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 129,
    key: 'ios',
    name: 'Ios',
    category: 'multi',
    currentMatch: 'Ios — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'IOS',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'Ios — Live',
    score: null,
    url: 'https://dfr80qz435crc.cloudfront.net/MNOP/Amagi/Caze/Caze_TV_BR/Caze_TV.m3u8',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 130,
    key: 'cazeios',
    name: 'Caze TV iOS',
    category: 'multi',
    currentMatch: 'Caze TV iOS — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'CZIOS',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'Portuguese',
    description: 'Caze TV iOS — Live',
    score: null,
    url: 'https://dfr80qz435crc.cloudfront.net/MNOP/Amagi/Caze/Caze_TV_BR/Caze_TV.m3u8',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 131,
    key: 'bein1iOS',
    name: 'Bein Sports iOS',
    category: 'multi',
    currentMatch: 'Bein Sports iOS — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'BEINI',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'Bein Sports iOS — Live',
    score: null,
    url: 'https://1nyaler.streamhostingcdn.top/stream/23/index.m3u8',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 132,
    key: 'fifaprime1',
    name: 'Fox Prime',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'FXPR',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'Fox Prime — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://otte-tim.live.pv-cdn.net/pdx-nitro/live/clients/dash/enc/ajfoeddkbz/out/v1/b78800b9b2304879b15843f455836829/cenc.mpd',
    clearKey: { keyId: 'f6564ec2aee819046328a0e153be574d', key: 'ff46a8a1031eb27ef22576a077c98ab7' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 137,
    key: 'tsn1',
    name: 'TSN1 English',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TSN1',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'TSN1 English — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://otte-tim.live.pv-cdn.net/pdx-nitro/live/clients/dash/enc/aezp9y6l15/out/v1/69a2a7041395406b970598f61680e7cf/cenc.mpd',
    clearKey: { keyId: '7b37e4614fcee2ec2ff6e5900c2f798f', key: 'f349a9c28c55c20b9a2c50af99d1fc76' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 138,
    key: 'beeline319',
    name: 'Beeline TV 319',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'BLN',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'English',
    description: 'Beeline TV 319 — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://video.beeline.tv/live/d/channel319.isml/manifest-stb.mpd',
    clearKey: { keyId: '9145a6e0f778e61866f573d4944dd533', key: 'd02173d40515fea5c83944f21d0f3114' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 139,
    key: 'Gsinema',
    name: 'Gsinema',
    category: 'multi',
    currentMatch: 'Gsinema — Live',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'GSIN',
    isLive: true,
    viewers: '—',
    badge: 'HD',
    language: 'Hindi',
    description: 'Gsinema — Live',
    score: null,
    url: 'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/Zeecinema/default/manifest.mpd',
    clearKey: { keyId: '43513b13f4b542e39c9265921dfc1726', key: 'b0b2678bcd274c37b888a6c987d502ed' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 140,
    key: 'trt2kfhd',
    name: 'TRT 2K FHD',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TRT',
    isLive: true,
    viewers: '—',
    badge: '2K',
    language: 'Turkish',
    description: 'TRT 2K FHD — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://tv-trt1-esdai.medya.trt.com.tr/master.m3u8',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  // ── Plain-HLS channels extracted from loura.json / id.json (?url= params) ──
  // No DRM; play natively. Grouped under the Star/Sony section.
  {
    id: 145, key: 'zee5bangla', name: 'Zee Bangla Sonar', category: 'starsony',
    currentMatch: 'Zee Bangla Sonar — Live', thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'ZBNG', isLive: true, viewers: '—', badge: 'HD', language: 'Bengali',
    description: 'Zee Bangla Sonar — Live', score: null,
    url: 'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/ColorsHD/default/master2.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 146, key: 'zeesportshindi', name: 'Zee Sports Hindi', category: 'starsony',
    currentMatch: 'Zee Sports Hindi — Live', thumbnail: T('1540747913346-19212a4b423f'),
    logo: 'ZSH', isLive: true, viewers: '—', badge: 'HD', language: 'Hindi',
    description: 'Zee Sports Hindi — Live', score: null,
    url: 'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/NGCHD/default/master2.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 147, key: 'zee5malayalam', name: 'Zee5 Malayalam', category: 'starsony',
    currentMatch: 'Zee5 Malayalam — Live', thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'ZML', isLive: true, viewers: '—', badge: 'HD', language: 'Malayalam',
    description: 'Zee5 Malayalam — Live', score: null,
    url: 'https://tk.lolcc.cfd/v/9c07cc0936d81598f5cd45853a82dbf0/467e27b87b4b/index.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 148, key: 'beinsportsarabic', name: 'Bein Sports Arabic', category: 'starsony',
    currentMatch: 'Bein Sports Arabic — Live', thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'BEIN', isLive: true, viewers: '—', badge: 'HD', language: 'Arabic',
    description: 'Bein Sports Arabic — Live', score: null,
    url: 'https://live.kooran53.cfd/goolato3.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 149, key: 'asiacup', name: 'Asia Cup Live', category: 'starsony',
    currentMatch: 'Asia Cup — Live', thumbnail: T('1531415074968-036ba1b575da'),
    logo: 'ASIA', isLive: true, viewers: '—', badge: 'HD', language: 'English',
    description: 'Asia Cup — Live Cricket', score: null,
    url: 'https://d3ssd0juqbxbw.cloudfront.net/mtvsinstlive/master.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 150, key: 'dillzy', name: 'Dillzy Cricket', category: 'starsony',
    currentMatch: 'Dillzy Cricket — Live', thumbnail: T('1540747913346-19212a4b423f'),
    logo: 'DLZ', isLive: true, viewers: '—', badge: 'HD', language: 'English',
    description: 'Dillzy Cricket — Live', score: null,
    url: 'https://dillzy.cricketstream745.workers.dev/live.m3u8',
    clearKey: null, quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 151, key: '7pluscricket', name: '7Plus Cricket', category: 'starsony',
    currentMatch: '7Plus Cricket — Live', thumbnail: T('1531415074968-036ba1b575da'),
    logo: '7PL', isLive: true, viewers: '—', badge: '720p', language: 'English',
    description: '7Plus Cricket — Live', score: null,
    url: 'https://hugh.cdn.rumble.cloud/live/gi29le7p/slot-139/bx1o-9vac_720p/chunklist.m3u8',
    clearKey: null, quality: ['Auto', '720p', '480p'],
  },
]

// ── FIFA channel status map ───────────────────────────────────────────────────
// 'hq'   = high quality + confirmed working (shown first)
// 'ok'   = working standard quality (shown second)
// 'down' = not working currently (shown last, visually dimmed)
// Keys must match the `key` field on the channel object.
export const FIFA_STATUS = {
  trt2kfhd:    'hq',   // 2K FHD — Turkish HLS, confirmed working
  foxusa:      'ok',
  fifaprime1:  'ok',
  telemundo2:  'ok',
  tsn1:        'ok',
  beeline319:  'ok',
}

// Priority for sorting: hq=0, ok=1, down=2
export function fifaStatusOf(key) {
  return FIFA_STATUS[key] ?? 'ok'
}

export const FIFA_SORT_WEIGHT = { hq: 0, ok: 1, down: 2 }

export const categories = [
  { id: 'all',         label: 'Trending',     icon: '🔥' },
  { id: 'fifa2026',    label: 'FIFA 2026',    icon: '🏆' },
  { id: 'fancode',     label: 'FanCode',      icon: '⚡' },
  { id: 'starsony',    label: 'Star / Sony',  icon: '⭐' },
  { id: 'sonyliv',     label: 'Sony LIV',     icon: '📺' },
  { id: 'iptvsports',  label: 'IPTV Sports',  icon: '📡' },
  { id: 'tamil',       label: 'Tamil',        icon: '🎬' },
  ...(FEATURES.TATAPLAY ? [{ id: 'tataplay', label: 'Tata Play', icon: '📡' }] : []),
  { id: 'zee5',        label: 'Zee5',         icon: '📺' },
  { id: 'cricket',     label: 'Cricket',      icon: '🏏' },
  { id: 'football',    label: 'Football',     icon: '⚽' },
  { id: 'tennis',      label: 'Tennis',       icon: '🎾' },
  { id: 'basketball',  label: 'Basketball',   icon: '🏀' },
  { id: 'formula1',    label: 'Formula 1',    icon: '🏎️' },
  { id: 'boxing',      label: 'Boxing',       icon: '🥊' },
  { id: 'multi',       label: 'Multi Sports', icon: '🎯' },
]
