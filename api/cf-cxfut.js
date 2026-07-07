// Vercel serverless — FIFA 2026 HLS streams fetched directly from cxfut.pages.dev
// Each channel URL is resolved server-side (follows redirects) so the client
// always gets the actual CDN stream URL, not a relay page.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cricfusion.netlify.app'
]

const MATCH = 'Colombia vs Portugal — FIFA WC 2026'

// src: full cxfut.pages.dev URL to fetch server-side
// vpn: country code if a VPN is required (null = worldwide)
const CHANNELS = [
  { id: 'U1',    src: 'https://cxfut.pages.dev/c1?id=U1',  name: 'Fox Sports HD',     logo: 'FOX',  language: 'English',    badge: 'HD',  vpn: null },
  { id: 'U5',    src: 'https://cxfut.pages.dev/c1?id=U5',  name: 'RPC Spanish HD',    logo: 'RPC',  language: 'Spanish',    badge: 'HD',  vpn: null },
  { id: 'U3',    src: 'https://cxfut.pages.dev/c1?id=U3',  name: 'CC5 Chinese HD',    logo: 'CC5',  language: 'Chinese',    badge: 'HD',  vpn: null },
  { id: 'U8',    src: 'https://cxfut.pages.dev/c1?id=U8',  name: 'English HD',        logo: 'ENG',  language: 'English',    badge: 'HD',  vpn: null },
  { id: 'U7',    src: 'https://cxfut.pages.dev/c1?id=U7',  name: 'Arabic HD',         logo: 'SA1',  language: 'Arabic',     badge: 'HD',  vpn: null },
  { id: 'NTV',   src: 'https://cxfut.pages.dev/?id=NTV',   name: 'NTV English HD',    logo: 'NTV',  language: 'English',    badge: 'HD',  vpn: null },
  { id: 'GOLTV', src: 'https://cxfut.pages.dev/?id=GOLTV', name: 'GolTV Colombia HD', logo: 'GLTV', language: 'Spanish',    badge: 'HD',  vpn: null },
  { id: 'CAZE1', src: 'https://cxfut.pages.dev/?id=CAZE1', name: 'CazéTV Brasil HD',  logo: 'CAZE', language: 'Portuguese', badge: 'HD',  vpn: 'BR' },
  { id: 'Tsn1',  src: 'https://cxfut.pages.dev/?id=Tsn1',  name: 'TSN Sports 1 HD',   logo: 'TSN1', language: 'English',    badge: 'HD',  vpn: 'CA' },
  { id: 'FOX',   src: 'https://cxfut.pages.dev/?id=FOX',   name: 'Fox 60fps FHD',     logo: 'FOX',  language: 'English',    badge: 'HD',  vpn: 'CA' },
  { id: 'FOX4K', src: 'https://cxfut.pages.dev/?id=FOX4K', name: 'Fox 4K UHD',        logo: 'FOX',  language: 'English',    badge: '4K',  vpn: 'CA' },
  { id: 'FB4K',  src: 'https://cxfut.pages.dev/?id=FB4K',  name: 'Fussball 4K UHD',   logo: 'FB4K', language: 'German',     badge: '4K',    vpn: 'DE' },
  // Additional Colombia vs Portugal channels
  { id: 'canal5mx', src: 'https://cxfut.pages.dev/?id=canal5mx', name: 'TUDN HD',        logo: 'TDN',  language: 'Spanish', badge: 'HD',    vpn: 'MX' },
  { id: 'bein1iOS', src: 'https://cxfut.pages.dev/?id=bein1iOS', name: 'Bein Sports iOS', logo: 'BEIN', language: 'Arabic',  badge: 'HD',    vpn: null },
  { id: 'ctv',      src: 'https://cxfut.pages.dev/?id=ctv',      name: 'CTV HD',          logo: 'CTV',  language: 'English', badge: 'HD',    vpn: null },
  { id: 'la1',      src: 'https://cxfut.pages.dev/?id=la1',      name: 'La 1 HD',         logo: 'LA1',  language: 'Spanish', badge: 'HD',    vpn: null },
  { id: 'peacock',  src: 'https://cxfut.pages.dev/?id=peacock',  name: 'Peacock 60fps',   logo: 'PCK',  language: 'English', badge: '60fps', vpn: 'US' },
]

let _id = 600

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  // Fetch all channel URLs in parallel, server-side.
  // Follow redirects so we get the actual CDN HLS URL, not a relay page.
  const results = await Promise.allSettled(
    CHANNELS.map((ch) =>
      fetch(ch.src, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer':    'https://cxfut.pages.dev/',
        },
      }).then((r) => {
        if (!r.ok) return null
        // r.url is the final URL after following all redirects
        const streamUrl = r.url !== ch.src ? r.url : ch.src
        return { ch, url: streamUrl }
      }).catch(() => null)
    )
  )

  _id = 600
  const channels = []

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) { _id++; continue }
    const { ch, url } = result.value
    channels.push({
      id:          _id++,
      key:         `cxfut_${ch.id.toLowerCase()}`,
      name:        ch.name,
      match:       MATCH,
      logo:        ch.logo,
      badge:       ch.badge,
      language:    ch.language,
      description: `${MATCH} — ${ch.name}`,
      vpn:         ch.vpn,
      url,
      keyId:       null,
      drmKey:      null,
    })
  }

  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(channels)
}
