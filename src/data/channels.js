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
    clearKey:     s.keyId ? { keyId: s.keyId, key: s.drmKey } : null,
    quality:      ['Auto', '1080p', '720p', '480p'],
  }
}

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
    key: 'WillowCricbuzz',
    name: 'Willow Cricbuzz TV',
    category: 'cricket',
    currentMatch: 'Willow Cricbuzz TV — Live',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'WLW',
    isLive: true,
    viewers: '1.1M',
    badge: 'HD',
    language: 'English',
    description: 'Willow Cricbuzz TV — Live Cricket',
    score: null,
    url: 'https://a57live-pv-ta-amazon.akamaized.net/iad-nitro/live/clients/dash/enc/4wja3cfwgg/out/v1/991189690f8b4dd68e0c674f6a398c39/cenc.mpd',
    clearKey: {
      keyId: '979b2f5b62f09438e96fb1fe44b820e2',
      key:   'b976ab1bf969845cf9e4fee85f456c8d',
    },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 103,
    key: 'FoxSports',
    name: 'Fox Sports',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'FOX',
    isLive: true,
    viewers: '2.1M',
    badge: 'HD',
    language: 'English',
    description: 'Fox Sports — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://abgfgo7aaaaaaaammo4qlji7ci5df.ta.bia-cf.live.pv-cdn.net/pdx-nitro/live/clients/dash/enc/ap5wz1ofsp/out/v1/7fa6feef143747beaa186ebb6dfb2532/cenc.mpd',
    clearKey: { keyId: 'c620c93c60c04999eb9ddc28ecfb70a8', key: 'e76a709c251313190e76cb3c3d3a5824' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 104,
    key: 'DirecTV',
    name: 'DirecTV Sports',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'DTV',
    isLive: true,
    viewers: '1.5M',
    badge: 'HD',
    language: 'Spanish',
    description: 'DirecTV Sports — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://otte.live.fly.ww.aiv-cdn.net/gru-nitro/live/clients/dash/enc/ubehitlwzo/out/v1/8e09c381a51f4366a19e979418112e8f/cenc.mpd',
    clearKey: { keyId: 'a7d11d37a1f7611ee88d4db880171f32', key: '68f96d618b0b956b008c445896a25a79' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 105,
    key: 'Telemundo',
    name: 'Telemundo',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TLM',
    isLive: true,
    viewers: '1.2M',
    badge: 'HD',
    language: 'Spanish',
    description: 'Telemundo — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://live-oneapp-prd-news.akamaized.net/Content/CMAF_OL2-CTR-4s-v2/Live/channel(kvea)/master.mpd',
    clearKey: { keyId: 'ce7ab3022e753307997f58afe001bac4', key: '72d631a66e635c60829a0fe7705516c1' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 106,
    key: 'TSN',
    name: 'TSN Sports',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TSN',
    isLive: true,
    viewers: '980K',
    badge: 'HD',
    language: 'English',
    description: 'TSN Sports — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://otte-qw.live.pv-cdn.net/lhr-nitro/live/clients/dash/enc/h9urpo3cwb/out/v1/fde190f369484bc6b6117cc16cd82a9f/cenc.mpd',
    clearKey: { keyId: 'c4088f5f265f9de50cffd80bf89308b7', key: '2c4d2239d96d532b4ec2050653611003' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 107,
    key: 'Cignal',
    name: 'Cignal TV',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'CGN',
    isLive: true,
    viewers: '760K',
    badge: 'HD',
    language: 'English',
    description: 'Cignal TV — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://qp-pldt-live-bpk-ucd-prod.akamaized.net/bpk-tv/ch299/default/index.mpd',
    clearKey: { keyId: '549ab7cd35a64bb6bb479ecead04d69d', key: '829799ed534d11fcadeb4b192467e050' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 108,
    key: 'CazeTV',
    name: 'Caze TV',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'CZV',
    isLive: true,
    viewers: '850K',
    badge: 'HD',
    language: 'Portuguese',
    description: 'Caze TV — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://a121aivottepl-a.akamaihd.net/gru-nitro/live/clients/dash/enc/jo3rmhhp2r/out/v1/50656942ce4e40a1be824c9d83578fe9/cenc.mpd',
    clearKey: { keyId: '34475edab991ad5e92548aebd710410a', key: '501b209cccd323ac00bf5ac15b406cb4' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 109,
    key: 'Zee5Bengali',
    name: 'Zee5 Bengali',
    category: 'cricket',
    currentMatch: 'Live on Zee5 Bengali',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'ZEE',
    isLive: true,
    viewers: '620K',
    badge: 'HD',
    language: 'Bengali',
    description: 'Zee5 Bengali — Live',
    score: null,
    url: 'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/Zeebanglacinema/default/manifest.mpd',
    clearKey: { keyId: 'fbbfd9ce4bbe4d818b16df7dfe89f05b', key: '1e96d0f88ef740e982d6f6105721c8bc' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 110,
    key: 'Zee5Hindi',
    name: 'Zee5 Hindi',
    category: 'cricket',
    currentMatch: 'Live on Zee5 Hindi',
    thumbnail: T('1546519638405-a9f1e9a4f7c5'),
    logo: 'ZEE',
    isLive: true,
    viewers: '740K',
    badge: 'HD',
    language: 'Hindi',
    description: 'Zee5 Hindi — Live',
    score: null,
    url: 'https://d1g8wgjurz8via.cloudfront.net/bpk-tv/Zeecinema/default/manifest.mpd',
    clearKey: { keyId: '43513b13f4b542e39c9265921dfc1726', key: 'b0b2678bcd274c37b888a6c987d502ed' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 111,
    key: 'TipikFR',
    name: 'Tipik FR',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'TPK',
    isLive: true,
    viewers: '540K',
    badge: 'HD',
    language: 'French',
    description: 'Tipik FR — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://c9851ec-rbm-hilv-fsly.cdn.redbee.live/L26/6b640fa2/a765d074.isml/dash/.mpd',
    clearKey: { keyId: 'adca25b8779e4168a0cd710f59f61ccf', key: 'be5383ed3cd8079f4ffe78ad067f476a' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 112,
    key: 'CanalSports',
    name: 'Canal Sports',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'CNL',
    isLive: true,
    viewers: '930K',
    badge: 'HD',
    language: 'Spanish',
    description: 'Canal Sports — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://nog-live-ott.izzigo.tv/out/u/dash/CDMX1/CANAL-5-RDF-HD/default.mpd',
    clearKey: { keyId: '2a8c2d5088377f51f825d871e568be19', key: 'eb5a8db64ca1992389672edb9447c711' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 113,
    key: 'Nu9ve',
    name: 'NU9VE',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'NV9',
    isLive: true,
    viewers: '480K',
    badge: 'HD',
    language: 'Spanish',
    description: 'NU9VE — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://live-pv-ta.amazon.fastly-edge.com/iad-nitro/live/clients/dash/enc/skz7pgjdyp/out/v1/8e7377f4d3154738b7f48baa996b35a5/cenc.mpd',
    clearKey: { keyId: '79737d20a3eaa862f8cb77c61cb3b58c', key: '41df11a0be44fd7272538728cec38bc6' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 114,
    key: 'VRTDutch',
    name: 'VRT Dutch',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'VRT',
    isLive: true,
    viewers: '560K',
    badge: 'HD',
    language: 'Dutch',
    description: 'VRT Dutch — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://live.vrtcdn.be/groupd/live/0761024f-37fe-4254-bc37-e95d7c62b2d1/live.isml/.mpd',
    clearKey: { keyId: '893bc63340876605f52886a42e0ccce5', key: 'd6c46d2d691056fbd091bf1f01b21a91' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 115,
    key: 'ORFGerman',
    name: 'ORF HD',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'ORF',
    isLive: true,
    viewers: '610K',
    badge: 'HD',
    language: 'German',
    description: 'ORF HD — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://simplitv-live.mdn.ors.at/live/eds/orf_1_hd-1/dash4h/orf_1_hd-1.mpd',
    clearKey: { keyId: '429bcf031bbf3146a67f3f583e4c4355', key: 'd1b92aba5a38a518c8b8a1fd2bca4398' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 116,
    key: 'ZDFGerman',
    name: 'ZDF HD',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'ZDF',
    isLive: true,
    viewers: '580K',
    badge: 'HD',
    language: 'German',
    description: 'ZDF HD — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://simplitv-live.mdn.ors.at/live/eds/zdf_hd/dash4h/zdf_hd.mpd',
    clearKey: { keyId: 'c1a0ac1044a433d0856ccdc08f245084', key: '7f0e8800a6d63d7915ac181bb88ce813' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 117,
    key: 'M6France',
    name: 'M6 France',
    category: 'fifa2026',
    currentMatch: 'FIFA World Cup 2026 — Live',
    thumbnail: T('1508098280132-0cd47883c18c'),
    logo: 'M6F',
    isLive: true,
    viewers: '690K',
    badge: 'HD',
    language: 'French',
    description: 'M6 France — FIFA World Cup 2026 Live',
    score: null,
    url: 'https://origin-m6web.live.6cloud.fr/out/v1/6play/6play-m6/cmaf_cenc00/dash-short-hd.mpd',
    clearKey: { keyId: '433ffba670963e70857859a9dff4be04', key: '51ede3a821229fe81e71282c8eff80e3' },
    quality: ['Auto', '1080p', '720p', '480p'],
  },
  {
    id: 118,
    key: 'prime',
    name: 'Prime video 1080p50',
    category: 'multi',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01037_FUSSBALLTV1_hd/DASH/index.mpd',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01064_FUSSBALLTV2_hd/DASH/index.mpd',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01065_FUSSBALLTV3_hd/DASH/index.mpd',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01037_FUSSBALLTV1_uhd/DASH/index.mpd',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01064_FUSSBALLTV2_uhd/DASH/index.mpd',
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
    url: 'https://svc45.main.sl.t-online.de/bpk-tv/KID01065_FUSSBALLTV3_uhd/DASH/index.mpd',
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
]

export const categories = [
  { id: 'all',         label: 'Trending',     icon: '🔥' },
  { id: 'fifa2026',    label: 'FIFA 2026',    icon: '🏆' },
  { id: 'fancode',     label: 'FanCode',      icon: '⚡' },
  { id: 'sonyliv',     label: 'Sony LIV',     icon: '📺' },
  ...(FEATURES.TATAPLAY ? [{ id: 'tataplay', label: 'Tata Play', icon: '📡' }] : []),
  { id: 'cricket',     label: 'Cricket',      icon: '🏏' },
  { id: 'football',    label: 'Football',     icon: '⚽' },
  { id: 'tennis',      label: 'Tennis',       icon: '🎾' },
  { id: 'basketball',  label: 'Basketball',   icon: '🏀' },
  { id: 'formula1',    label: 'Formula 1',    icon: '🏎️' },
  { id: 'boxing',      label: 'Boxing',       icon: '🥊' },
  { id: 'multi',       label: 'Multi Sports', icon: '🎯' },
]
