// ── Static channel metadata (display info) ───────────────────────────────────
// Stream URLs + clearKeys are fetched live from the API (always-fresh tokens).
// Only add UI fields here — never hardcode stream URLs.
// localStorage.setItem('cf_dev', '1')
// Display order for API channels
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
    name: 'Sony LIV Sports 1', logo: 'SL1', category: 'multi',
    language: 'English', badge: 'HD', viewers: '1.6M',
    thumbnail: T('1574629810360-7efbbe195018'),    // football
  },
  s2: {
    name: 'Sony LIV Sports 2', logo: 'SL2', category: 'multi',
    language: 'English', badge: 'HD', viewers: '980K',
    thumbnail: T('1461896836934-ffe607ba8211'),    // sports stadium
  },
  s3: {
    name: 'Sony LIV Sports 3', logo: 'SL3', category: 'multi',
    language: 'English', badge: 'HD', viewers: '750K',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),    // basketball arena
  },
  s5: {
    name: 'Sony LIV Sports 5', logo: 'SL5', category: 'multi',
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

// ── Dynamic per-channel API (newwwwapiiiiii.vercel.app/main?id=...) ──────────
// Each entry is fetched individually; SW proxies via /cf-dynamic?id=...
// Response shape: { id, name, Bearer, url, k1, k2 }

export const DYNAMIC_CHANNEL_IDS = ['willow', 'skynz1uhd', 'e1s4']

const DYNAMIC_META = {
  willow: {
    name: 'Willow TV',       logo: 'WLW',  category: 'cricket',
    language: 'English', badge: 'HD',  viewers: '750K',
    thumbnail: T('1508098682722-e99c43a406b2'),    // cricket match
  },
  skynz1uhd: {
    name: 'Sky Sport 1 UHD', logo: 'SKY1', category: 'cricket',
    language: 'English', badge: '4K',  viewers: '420K',
    thumbnail: T('1574629810360-7efbbe195018'),    // NZ/sky sports feel
  },
  e1s4: {
    name: null,              logo: 'E1S4', category: 'multi',
    language: 'English', badge: 'HD',  viewers: '350K',
    thumbnail: T('1461896836934-ffe607ba8211'),    // multi-sport stadium
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

// Rewrite FanCode CDN URLs to the same-origin /fc-cdn proxy so browsers
// don't attach Origin/sec-fetch-site: cross-site (which causes 403).
function toFcProxy(url) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (u.hostname === 'in-mc-fblive.fancode.com') return `/fc-cdn${u.pathname}${u.search}`
  } catch {}
  return url   // Google DAI and other hosts pass through unchanged
}

export function mapFanCodeChannel(match) {
  const primary  = toFcProxy(match.adfree_url || match.dai_url)
  const fallback = (match.adfree_url && match.dai_url && match.adfree_url !== match.dai_url)
                     ? toFcProxy(match.dai_url) : null
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

// ── Static channels (fixed URLs, not in any API) ─────────────────────────────
export const STATIC_CHANNELS = [
  {
    id: 101,
    key: 'willowios',
    name: 'Willow Sports',
    category: 'cricket',
    currentMatch: 'Willow Sports — Live',
    thumbnail: T('1568605117036-5fe5e7bab0b7'),
    logo: 'WLW',
    isLive: true,
    viewers: '890K',
    badge: 'HD',
    language: 'English',
    description: 'Willow Sports — Live cricket from the USA',
    score: null,
    url: 'https://amg01269-amg01269c1-sportstribal-emea-5204.playouts.now.amagi.tv/playlist/amg01269-willowtvfast-willowplus-sportstribalemea/playlist.m3u8',
    clearKey: null,
    quality: ['Auto', '1080p', '720p', '480p', '360p'],
  },
  {
    id: 102,
    key: 'NZvsEN',
    name: 'Willow — NZ vs ENG',
    category: 'cricket',
    currentMatch: 'New Zealand vs England — Live',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'WLW',
    isLive: true,
    viewers: '1.1M',
    badge: 'HD',
    language: 'English',
    description: 'New Zealand vs England — Live on Willow',
    score: null,
    url: 'https://abkyrm4aaaaaaaamfyfksth3wr44v.ta.bia-cf.live.pv-cdn.net/iad-nitro/live/clients/dash/enc/6wpu3krmcv/out/v1/109ca06d29e345d195b01b39b13817d3/cenc.mpd',
    clearKey: {
      keyId: 'b9e0acbe1a43f4f979089a8bd54fc307',
      key:   'f22316910c4419e1aa88de5334d00f79',
    },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
]

export const categories = [
  { id: 'all',         label: 'All Sports',   icon: '🏆' },
  { id: 'fancode',    label: 'FanCode',      icon: '⚡' },
  { id: 'cricket',    label: 'Cricket',      icon: '🏏' },
  { id: 'football',   label: 'Football',     icon: '⚽' },
  { id: 'tennis',     label: 'Tennis',       icon: '🎾' },
  { id: 'basketball', label: 'Basketball',   icon: '🏀' },
  { id: 'formula1',   label: 'Formula 1',    icon: '🏎️' },
  { id: 'boxing',     label: 'Boxing',       icon: '🥊' },
  { id: 'multi',      label: 'Multi Sports', icon: '🎯' },
]
