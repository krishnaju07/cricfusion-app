// Vercel serverless — FIFA 2026 stream data.
// Dynamic channels are fetched live from footapi (keys + URLs always fresh).
// Static channels are for streams not available in footapi.
// Referer-locked: only cricfusion.netlify.app and localhost may fetch this.

const ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cricfusion.netlify.app'
]

const FOOTAPI_URL = 'https://footapi-psi.vercel.app/main'
const FOOTAPI_ORIGIN = 'https://footsterss.pages.dev'

// UI metadata for footapi channel IDs (logo, language, badge, mimeType)
const FOOTAPI_META = {
  fifaprime1:      { logo: 'FOX',  language: 'English',    badge: '4K' },
  foxavc:          { logo: 'FOX',  language: 'English' },
  foxusa:          { logo: 'FOX',  language: 'English',    badge: '720p' },
  cazetvprime:     { logo: 'CZE',  language: 'Portuguese' },
  cazeios:         { logo: 'CZE',  language: 'Portuguese' },
  ntv:             { logo: 'WCT',  language: 'English' },
  dsports:         { logo: 'DSP',  language: 'Spanish' },
  m6:              { logo: 'M6',   language: 'French',     mimeType: 'application/dash+xml', vpn: 'FR' },
  telemundo:       { logo: 'TMD',  language: 'Spanish' },
  telemundo2:      { logo: 'TMD',  language: 'Spanish' },
  tsn1:            { logo: 'TSN',  language: 'English' },
  fussball1:       { logo: 'FBL',  language: 'German',     vpn: 'DE' },
  fussball2:       { logo: 'FBL',  language: 'German',     vpn: 'DE' },
  fussball3:       { logo: 'FBL',  language: 'German',     vpn: 'DE' },
  fussball1uhd:    { logo: 'FBL',  language: 'German',     badge: '4K', vpn: 'DE' },
  fussball2uhd:    { logo: 'FBL',  language: 'German',     badge: '4K', vpn: 'DE' },
  fussball3uhd:    { logo: 'FBL',  language: 'German',     badge: '4K', vpn: 'DE' },
  unite8sports1hd: { logo: 'US1',  language: 'English' },
  unite8sports2hd: { logo: 'US1',  language: 'Hindi' },
  ios:             { logo: 'FIFA', language: 'English' },
  foxios:          { logo: 'FOX',  language: 'English' },
  tsn1ios:         { logo: 'TSN',  language: 'English' },
  bein1iOS:        { logo: 'BEIN', language: 'Arabic' },
  Gsinema:         { logo: 'GSN',  language: 'Hindi' },
  rte2:            { logo: 'RTE',  language: 'English' },
  canal5mx:        { logo: 'TDN',  language: 'Spanish' },
  trt1ios:         { logo: 'TRT',  language: 'Turkish' },
  sportvbrazil:    { logo: 'SPV',  language: 'Portuguese' },
}

// Footapi IDs to skip:
// - 'rte2' covered by static fifa_rte_sport (better metadata)
// - others covered by iptv-eldbert (priority 1)
const FOOTAPI_SKIP = new Set([
  'rte2',
  'dsports',       // iptv: DSports
  'cazetvprime',   // iptv: Cazé TV
  'cazeios',       // iptv: Cazé TV (same content)
  'telemundo',     // iptv: Telemundo USA
  'canal5mx',      // iptv: Canal 5 MX
  'foxusa',        // iptv: Fox Sports 1 USA
  'foxavc',        // iptv: Fox Sports 1 USA (alt CDN, same content)
])

// Priority channels pinned to the top of the FIFA section.
// ITV is in footapi but only via ?id= endpoint (not returned by /main), so served here.
// CT Sport is from the antik.sk IPTV service (not in footapi at all).
const PRIORITY_STREAMS = [
  {
    id: 329,
    key: 'fifa_fox_bom',
    name: 'Fox HD',
    match: 'Fox HD',
    logo: 'FOX',
    language: 'English',
    badge: 'HD',
    description: 'Fox HD — FIFA World Cup 2026',
    url: 'https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/enc/ajfoeddkbz/out/v1/b78800b9b2304879b15843f455836829/cenc.mpd',
    keyId:  'f6564ec2aee819046328a0e153be574d',
    drmKey: 'ff46a8a1031eb27ef22576a077c98ab7',
  },
  {
    id: 330,
    key: 'fifa_hd2_lhr',
    name: 'FIFA HD 2',
    match: 'FIFA HD 2',
    logo: 'FIFA',
    language: 'English',
    badge: 'HD',
    description: 'FIFA HD 2 — FIFA World Cup 2026',
    url: 'https://otte.live.fly.ww.aiv-cdn.net/lhr-nitro/live/clients/dash/enc/3ynrpdanq2/out/v1/81fd4c26584044d2b1a1cc5b32fa9af0/cenc.mpd',
    keyId:  null,
    drmKey: null,
  },
  {
    id: 327,
    key: 'fifa_itv1_eng',
    name: 'ITV 1',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'ITV',
    language: 'English',
    description: 'FIFA World Cup 2026 — ITV 1 (UK)',
    url: 'https://abgh3fbaaaaaaaambylpff72g6up6.ta.bia-cf.live.pv-cdn.net/iad-nitro/live/dash/enc/0eiyyz8qzm/out/v1/dd17af8835fe4bd087d1a4e359b635d7/cenc.mpd',
    keyId:  '30089c52924f037b225b82c616fee2a5',
    drmKey: 'f55dc8b66ed4fc6753d6035ae7e17144',
  },
  {
    id: 328,
    key: 'fifa_ct_sport',
    name: 'CT Sport',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'CTS',
    language: 'Czech',
    description: 'FIFA World Cup 2026 — CT Sport (Czech)',
    vpn: 'CZ',
    url: 'https://dash2.antik.sk/stream/nvidia_ct_sport/playlist_cenc.mpd',
    keyId:  '11223344556677889900112233445566',
    drmKey: '4b80724d0ef86bcb2c21f7999d67739d',
  },
]

// Static channels not available from footapi
const STATIC_STREAMS = [
  // ── 4K ────────────────────────────────────────────────────────────────
  {
    id: 310,
    key: 'fifa_tudn_4k',
    name: 'TUDN 4K',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'TDN',
    badge: '4K',
    language: 'Spanish',
    description: 'FIFA World Cup 2026 — TUDN 4K',
    url: 'https://otte.live.fly.ww.aiv-cdn.net/gru-nitro/live/clients/dash/enc/8u9cregwlt/out/v1/687f6b2a559943549be271504a948ffd/cenc.mpd',
    keyId:  '1710ac2bbfcd3032d0f6533850968f47',
    drmKey: 'd2548dacc8efcd1cd0af0373060c82dc',
  },
  // ── HD ────────────────────────────────────────────────────────────────
  {
    id: 309,
    key: 'fifa_stream_hd',
    name: 'FIFA Stream HD',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'FIFA',
    language: 'English',
    description: 'FIFA World Cup 2026 — Live Stream HD',
    url: 'https://otte.live.fly.ww.aiv-cdn.net/lhr-nitro/live/clients/dash/enc/62qdkefv9f/out/v1/f7d5b356e048494a8325563e8916d50b/cenc.mpd',
    keyId:  'fd86dde0ae3e14ff51c8fc8f248a50db',
    drmKey: 'd106ae78b0893da2e4393ece99420baa',
  },
  {
    id: 325,
    key: 'fifa_orf_hd',
    name: 'ORF 1 HD',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'ORF',
    language: 'German',
    description: 'FIFA World Cup 2026 — ORF 1 HD (Austria)',
    vpn: 'AT',
    url: 'https://simplitv-live.mdn.ors.at/live/eds/orf_1_hd-1/dash4h/orf_1_hd-1.mpd',
    keyId:  '429bcf031bbf3146a67f3f583e4c4355',
    drmKey: 'd1b92aba5a38a518c8b8a1fd2bca4398',
  },
  {
    id: 326,
    key: 'fifa_zdf_hd',
    name: 'ZDF HD',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'ZDF',
    language: 'German',
    description: 'FIFA World Cup 2026 — ZDF HD (Germany)',
    vpn: 'DE',
    url: 'https://simplitv-live.mdn.ors.at/live/eds/zdf_hd/dash4h/zdf_hd.mpd',
    keyId:  'c1a0ac1044a433d0856ccdc08f245084',
    drmKey: '7f0e8800a6d63d7915ac181bb88ce813',
  },
  {
    id: 311,
    key: 'fifa_unifi_tv',
    name: 'Unifi TV',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'UFI',
    language: 'English',
    description: 'FIFA World Cup 2026 — Unifi TV',
    url: 'https://ngtv-live-cbj.gcdn.co/Content/DASH/Live/channel(fifa1)/master.mpd',
    keyId:  '10e2114398744f3880cc96653568da55',
    drmKey: 'd6d40441f9fbebea03ec64c4aea7211f',
  },
  // ── Standard ──────────────────────────────────────────────────────────
  {
    id: 301,
    key: 'fifa_mex_rsa',
    name: 'FIFA 2026',
    match: 'Mexico vs South Africa — Live',
    logo: 'FIFA',
    language: 'English',
    description: 'FIFA World Cup 2026 — Mexico vs South Africa',
    url: 'https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/h9urpo3cwb/out/v1/fde190f369484bc6b6117cc16cd82a9f/cenc.mpd',
    keyId:  'c4088f5f265f9de50cffd80bf89308b7',
    drmKey: '2c4d2239d96d532b4ec2050653611003',
  },
  {
    id: 302,
    key: 'fifa_opening_tsn3',
    name: 'TSN 3',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'TSN',
    language: 'English',
    description: 'FIFA World Cup 2026 — TSN 3',
    url: 'https://live-pv-ta.amazon.fastly-edge.com/syd-nitro/live/clients/dash/enc/lzhmuzmjsl/out/v1/c171eeb214c749f2b351c79df317b21e/cenc.mpd',
    keyId:  'f5c2b30eac11be1e8cdfc9585f5fe6af',
    drmKey: 'a8198d17bf9b0da77450fbb919a38b2d',
  },
  {
    id: 303,
    key: 'fifa_opening_sportotv',
    name: 'Sporto TV',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'SPT',
    language: 'English',
    description: 'FIFA World Cup 2026 — Sporto TV',
    url: 'https://a151aivottlinear-a.akamaihd.net/OTTB/sin-nitro/live/dash/enc/m7duvnk2bu/out/v1/d1ad69118b5647309b1eb7213affdb3d/cenc.mpd',
    keyId:  '4bbcff3289d457b4dd5dbdd21221de9a',
    drmKey: 'c4906b9a9f8dda3c0725bddb8c497733',
  },
  {
    id: 320,
    key: 'fifa_rte_sport',
    name: 'RTÉ Sport',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'RTE',
    language: 'English',
    description: 'FIFA World Cup 2026 — RTÉ Sport',
    url: 'https://dai.google.com/linear/dash/pa/event/antwa0EiQm2PoHtx4rBtVw/stream/0c8b0b72-7a38-4852-ab2e-3fd88cbe71cc:GRQ/manifest.mpd',
    keyId:  'd816287e21496989eae1312925a423c5',
    drmKey: '00da00f13180e7e6cd5ce87d1c974e8d',
  },
  {
    id: 322,
    key: 'fifa_tipik_fr',
    name: 'Tipik',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'TPK',
    language: 'French',
    description: 'FIFA World Cup 2026 — Tipik (Belgium)',
    vpn: 'BE',
    url: 'https://c9851ec-rbm-hilv-fsly.cdn.redbee.live/L26/6b640fa2/a765d074.isml/dash/.mpd',
    keyId:  'adca25b8779e4168a0cd710f59f61ccf',
    drmKey: 'be5383ed3cd8079f4ffe78ad067f476a',
  },
  {
    id: 304,
    key: 'fifa_opening_telemundo',
    name: 'Telemundo',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'TMD',
    language: 'Spanish',
    description: 'FIFA World Cup 2026 — Telemundo',
    url: 'https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/vaplpo3app/out/v1/49b4d538ec854efa90d45084866cf7f9/cenc.mpd',
    keyId:  'd14658a0ede94debcb4013b2056ba6d1',
    drmKey: '60838a3176127fed0eaf038a5575de11',
  },
  {
    id: 315,
    key: 'fifa_canal_sports',
    name: 'Canal Sports',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'CNL',
    language: 'Spanish',
    description: 'FIFA World Cup 2026 — Canal Sports',
    url: 'https://nog-live-ott.izzigo.tv/out/u/dash/CDMX1/CANAL-5-RDF-HD/default.mpd',
    keyId:  '2a8c2d5088377f51f825d871e568be19',
    drmKey: 'eb5a8db64ca1992389672edb9447c711',
  },
  {
    id: 314,
    key: 'fifa_vix_tv',
    name: 'ViX TV',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'VIX',
    language: 'Spanish',
    description: 'FIFA World Cup 2026 — ViX TV',
    url: 'https://live-pv-ta.amazon.fastly-edge.com/iad-nitro/live/clients/dash/enc/skz7pgjdyp/out/v1/8e7377f4d3154738b7f48baa996b35a5/cenc.mpd',
    keyId:  '79737d20a3eaa862f8cb77c61cb3b58c',
    drmKey: '41df11a0be44fd7272538728cec38bc6',
  },
  {
    id: 313,
    key: 'fifa_vrt_tv',
    name: 'VRT TV',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'VRT',
    language: 'Dutch',
    description: 'FIFA World Cup 2026 — VRT TV',
    vpn: 'BE',
    url: 'https://live.vrtcdn.be/groupd/live/0761024f-37fe-4254-bc37-e95d7c62b2d1/live.isml/.mpd',
    keyId:  '893bc63340876605f52886a42e0ccce5',
    drmKey: 'd6c46d2d691056fbd091bf1f01b21a91',
  },
  {
    id: 323,
    key: 'fifa_joj_sport',
    name: 'JOJ Sport',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'JOJ',
    language: 'Slovak',
    description: 'FIFA World Cup 2026 — JOJ Sport',
    vpn: 'SK',
    url: 'https://dash2.antik.sk/stream/nvidia_joj_sport/playlist_cenc.mpd',
    keyId:  '11223344556677889900112233445566',
    drmKey: '4b80724d0ef86bcb2c21f7999d67739d',
  },
]

// Maps a footapi entry to our channel shape
let _dynId = 400
function mapFootapi(s) {
  const meta = FOOTAPI_META[s.id] || {}
  return {
    id:          _dynId++,
    key:         `fifa_dyn_${s.id}`,
    name:        s.name,
    match:       'FIFA World Cup 2026 — Live',
    logo:        meta.logo  ?? s.id.slice(0, 4).toUpperCase(),
    badge:       meta.badge ?? 'HD',
    language:    meta.language ?? 'English',
    description: `FIFA World Cup 2026 — ${s.name}`,
    url:         s.url,
    mimeType:    meta.mimeType,
    vpn:         meta.vpn ?? null,
    keyId:       s.k1 || null,
    drmKey:      s.k2 || null,
  }
}

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  // Fetch dynamic channels from footapi; fall back to empty if unreachable
  let dynamicChannels = []
  try {
    const upstream = await fetch(FOOTAPI_URL, {
      headers: { origin: FOOTAPI_ORIGIN },
    })
    if (upstream.ok) {
      const data = await upstream.json()
      _dynId = 400
      dynamicChannels = data
        .filter((s) => s.url && !FOOTAPI_SKIP.has(s.id))
        .map(mapFootapi)
    }
  } catch { /* footapi unavailable — serve static only */ }

  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json([...PRIORITY_STREAMS, ...dynamicChannels, ...STATIC_STREAMS])
}
