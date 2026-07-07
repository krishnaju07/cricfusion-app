// Vercel serverless — FIFA 2026 streams from footsters-live.pages.dev and footsters-tv.pages.dev
// Fetches with iPhone UA and follows redirects to resolve actual CDN HLS stream URLs.
// Referer-locked: only cricfusion.vercel.app and localhost may fetch this.

const ALLOWED = [
  'https://cricfusion.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cricfusion.netlify.app'
]

// src: URL to fetch — the final redirect target becomes the stream URL
const CHANNELS = [
  { id: 'fst_tsn1',       src: 'https://footsters-live.pages.dev/?id=tsn1',                    name: 'TSN 1',         logo: 'TSN1', language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_cazetvprime', src: 'https://footsters-live.pages.dev/?id=cazetvprime',             name: 'Caze TV Prime', logo: 'CZE',  language: 'Portuguese', badge: 'HD', vpn: 'BR'  },
  { id: 'fst_itv',        src: 'https://footsters-live.pages.dev/?id=itv',                     name: 'ITV 1',         logo: 'ITV',  language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_ntv',        src: 'https://footsters-live.pages.dev/?id=ntv',                     name: 'NTV English',   logo: 'WCT',  language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_bein_ios',   src: 'https://footsters-live.pages.dev/?id=bein1iOS',                name: 'BeIN Sports',   logo: 'BEIN', language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_fox',        src: 'https://footsters-tv.pages.dev/1?play=50066&stream=0',         name: 'Fox',           logo: 'FOX',  language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_sportstv',   src: 'https://footsters-tv.pages.dev/1?play=50066&stream=5',         name: 'Sports TV',     logo: 'STV',  language: 'English',    badge: 'HD', vpn: null  },
  { id: 'fst_fox_sd',     src: 'https://footsters-tv.pages.dev/1?play=50066&stream=9',         name: 'Fox SD',        logo: 'FOX',  language: 'English',    badge: 'SD', vpn: null  },
  { id: 'fst_la1',        src: 'https://footsters-tv.pages.dev/1?play=50066&stream=7',         name: 'La 1',          logo: 'LA1',  language: 'Spanish',    badge: 'HD', vpn: null  },
]

let _id = 700

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  const allowed = ALLOWED.some((o) => referer.startsWith(o))
  if (!allowed) return res.status(403).end('Forbidden')

  const results = await Promise.allSettled(
    CHANNELS.map((ch) => {
      const ref = ch.src.includes('footsters-tv') ? 'https://footsters-tv.pages.dev/' : 'https://footsters-live.pages.dev/'
      return fetch(ch.src, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer':    ref,
        },
      }).then((r) => {
        if (!r.ok) return null
        const streamUrl = r.url !== ch.src ? r.url : null
        return streamUrl ? { ch, url: streamUrl } : null
      }).catch(() => null)
    })
  )

  _id = 700
  const channels = []

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) { _id++; continue }
    const { ch, url } = result.value
    channels.push({
      id:          _id++,
      key:         ch.id,
      name:        ch.name,
      match:       ch.name,
      logo:        ch.logo,
      badge:       ch.badge,
      language:    ch.language,
      description: `${ch.name} — Live`,
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
