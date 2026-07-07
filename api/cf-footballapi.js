// Vercel serverless — FIFA 2026 streams from footballapi-delta.vercel.app
// Requires Origin: https://footsters-tv.pages.dev to bypass upstream auth.
// Filters to FIFA World Cup only; returns channel_title as the display name.

const ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://cricfusion.netlify.app'
]

const API_URL    = 'https://footballapi-delta.vercel.app/api/op'
const API_ORIGIN = 'https://footsters-tv.pages.dev'

// Logo mapping keyed on lowercase fragments of channel_title
const LOGO_MAP = [
  ['fox sports',  'FOX' ],
  ['fox one',     'FOX' ],
  ['fox 4k',      'FOX' ],
  ['fox',         'FOX' ],
  ['tsn',         'TSN1'],
  ['itv',         'ITV' ],
  ['caze',        'CZE' ],
  ['sportv',      'SPV' ],
  ['tipik',       'TPK' ],
  ['m6',          'M6'  ],
  ['telemundo',   'TMD' ],
  ['universeo',   'UNI' ],
  ['dsports',     'DSP' ],
  ['d sports',    'DSP' ],
  ['fussball',    'FBL' ],
  ['wc tv',       'FIFA'],
  ['match football', 'FIFA'],
  ['peacock',     'PCK' ],
  ['ct sport',    'CTS' ],
  ['tvp',         'TVP' ],
  ['ctv',         'CTV' ],
  ['match tv',    'MTC' ],
  ['canal5',      'TDN' ],
  ['la 1',        'LA1' ],
  ['tve',         'LA1' ],
]

// VPN country codes keyed on lowercase fragments of channel_title
const VPN_MAP = [
  ['[ger]',    'DE'],
  ['(ger)',    'DE'],
  ['fussball', 'DE'],
  ['[usa]',    'US'],
  ['(usa)',    'US'],
  ['peacock',  'US'],
  ['[cz]',     'CZ'],
  ['ct sport', 'CZ'],
  ['[br]',     'BR'],
  ['caze',     'BR'],
  ['sportv',   'BR'],
  ['[fr]',     'FR'],
  ['tipik',    'FR'],
  ['m6',       'FR'],
  ['[ru]',     'RU'],
  ['match tv', 'RU'],
  ['[mx]',     'MX'],
  ['canal5',   'MX'],
  ['[pl]',     'PL'],
  ['tvp',      'PL'],
  ['[ca]',     'CA'],
  ['ctv',      'CA'],
]

// Language hints keyed on lowercase fragments
const LANG_MAP = [
  ['fussball',   'German'    ],
  ['tipik',      'French'    ],
  ['m6',         'French'    ],
  ['telemundo',  'Spanish'   ],
  ['universeo',  'Spanish'   ],
  ['canal5',     'Spanish'   ],
  ['d sports',   'Spanish'   ],
  ['dsports',    'Spanish'   ],
  ['la 1',       'Spanish'   ],
  ['tve',        'Spanish'   ],
  ['caze',       'Portuguese'],
  ['sportv',     'Portuguese'],
  ['match tv',   'Russian'   ],
  ['tvp',        'Polish'    ],
  ['ct sport',   'Czech'     ],
]

function detect(title, map, fallback) {
  const lc = title.toLowerCase()
  for (const [frag, val] of map) {
    if (lc.includes(frag)) return val
  }
  return fallback
}

function badge(title) {
  if (title.includes('4K') || title.includes(' 4k')) return '4K'
  if (title.includes('FHD') || title.includes('fhd')) return 'FHD'
  return 'HD'
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

let _id = 800

export default async function handler(req, res) {
  const referer = req.headers['referer'] || req.headers['origin'] || ''
  if (!ALLOWED.some((o) => referer.startsWith(o))) return res.status(403).end('Forbidden')

  let data
  try {
    const upstream = await fetch(`${API_URL}?_t=${Date.now()}`, {
      headers: {
        origin:               API_ORIGIN,
        referer:              `${API_ORIGIN}/`,
        'user-agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        accept:               '*/*',
        dnt:                  '1',
        'sec-fetch-dest':     'empty',
        'sec-fetch-mode':     'cors',
        'sec-fetch-site':     'cross-site',
        'sec-ch-ua':          '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile':   '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
    })
    if (!upstream.ok) return res.status(502).end(`Upstream ${upstream.status}`)
    data = await upstream.json()
  } catch {
    return res.status(502).end('Upstream fetch failed')
  }

  const raw = Array.isArray(data?.data) ? data.data : []

  // Filter to FIFA World Cup only
  const fifa = raw.filter((s) => s.event_cat === 'FIFA World Cup' && s.stream_url)

  _id = 800
  const channels = fifa.map((s) => {
    const title = s.channel_title || `Stream ${_id - 799}`
    return {
      id:          _id++,
      key:         `fbapi_${slugify(title)}_${s.event_id}`,
      name:        title,
      match:       title,
      category:    'wc2026live',
      logo:        detect(title, LOGO_MAP, 'FIFA'),
      badge:       badge(title),
      language:    detect(title, LANG_MAP, 'English'),
      description: `${title} — ${s.event_name}`,
      vpn:         detect(title, VPN_MAP, null),
      url:         s.stream_url,
      keyId:       s.keyid  || null,
      drmKey:      s.key    || null,
    }
  })

  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(channels)
}
