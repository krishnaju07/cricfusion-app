// Vercel serverless — FIFA 2026 stream data.
// clearKeys and URLs never ship in the JS bundle; served server-side only.
// Referer-locked: only cricfusion.vercel.app and localhost may fetch this.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const FIFA_STREAMS = [
  {
    id: 301,
    key: 'fifa_mex_rsa',
    name: 'FIFA 2026 — Mexico vs South Africa',
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
    name: 'FIFA Opening — TSN 3',
    match: 'FIFA World Cup Opening Ceremony — Live',
    logo: 'TSN',
    language: 'English',
    description: 'FIFA World Cup 2026 Opening Ceremony — TSN 3',
    url: 'https://live-pv-ta.amazon.fastly-edge.com/syd-nitro/live/clients/dash/enc/lzhmuzmjsl/out/v1/c171eeb214c749f2b351c79df317b21e/cenc.mpd',
    keyId:  'f5c2b30eac11be1e8cdfc9585f5fe6af',
    drmKey: 'a8198d17bf9b0da77450fbb919a38b2d',
  },
  {
    id: 303,
    key: 'fifa_opening_sportotv',
    name: 'FIFA Opening — Sporto TV',
    match: 'FIFA World Cup Opening Ceremony — Live',
    logo: 'SPT',
    language: 'English',
    description: 'FIFA World Cup 2026 Opening Ceremony — Sporto TV',
    url: 'https://a151aivottlinear-a.akamaihd.net/OTTB/sin-nitro/live/dash/enc/m7duvnk2bu/out/v1/d1ad69118b5647309b1eb7213affdb3d/cenc.mpd',
    keyId:  '4bbcff3289d457b4dd5dbdd21221de9a',
    drmKey: 'c4906b9a9f8dda3c0725bddb8c497733',
  },
  {
    id: 304,
    key: 'fifa_opening_telemundo',
    name: 'FIFA Opening — Telemundo',
    match: 'FIFA World Cup Opening Ceremony — Live',
    logo: 'TMD',
    language: 'Spanish',
    description: 'FIFA World Cup 2026 Opening Ceremony — Telemundo',
    url: 'https://otte.cache.aiv-cdn.net/bom-nitro/live/clients/dash/enc/vaplpo3app/out/v1/49b4d538ec854efa90d45084866cf7f9/cenc.mpd',
    keyId:  'd14658a0ede94debcb4013b2056ba6d1',
    drmKey: '60838a3176127fed0eaf038a5575de11',
  },
  {
    id: 305,
    key: 'fifa_opening_tsn',
    name: 'FIFA Opening — TSN',
    match: 'FIFA World Cup Opening Ceremony — Live',
    logo: 'TSN',
    language: 'English',
    description: 'FIFA World Cup 2026 Opening Ceremony — TSN',
    url: 'https://live-oneapp-prd-news.akamaized.net/Content/CMAF_OL2-CTR-4s-v2/Live/channel(kvea)/master.mpd',
    keyId:  'ce7ab3022e753307997f58afe001bac4',
    drmKey: '72d631a66e635c60829a0fe7705516c1',
  },
  {
    id: 306,
    key: 'fifa_opening_worldcuptv',
    name: 'FIFA Opening — World Cup TV',
    match: 'FIFA World Cup Opening Ceremony — Live',
    logo: 'WCT',
    language: 'English',
    description: 'FIFA World Cup 2026 Opening Ceremony — World Cup TV',
    url: 'https://qp-pldt-live-bpk-ucd-prod.akamaized.net/bpk-tv/ch299/default/index.mpd',
    keyId:  '549ab7cd35a64bb6bb479ecead04d69d',
    drmKey: '829799ed534d11fcadeb4b192467e050',
  },
  {
    id: 307,
    key: 'fifa_united_sports_1',
    name: 'United Sports 1 HD',
    match: 'FIFA World Cup 2026 — Live',
    logo: 'US1',
    language: 'English',
    description: 'FIFA World Cup 2026 — United Sports 1 HD',
    url: 'https://sundirectgo-live.pc.cdn.bitgravity.com/svchd14/dth.mpd',
    keyId:  '501cb89acad2407e067c8ded661892f5',
    drmKey: 'bfa0488efaae9ec16775747c80ee54a7',
  },
]

export default function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(FIFA_STREAMS)
}
