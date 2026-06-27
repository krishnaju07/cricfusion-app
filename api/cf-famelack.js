// Fetches famelack channel data (gzip-compressed JSON from GitHub),
// filters, and returns CricFusion-shaped channel objects.
//
// Query params:
//   src=tamil  (default) → countries/in.json filtered to language=tam, category='tamil'
//   src=sports            → categories/sports.json, all HLS streams, category='iptvsports'

import { gunzipSync } from 'zlib'

const BASE = 'https://raw.githubusercontent.com/famelack/famelack-data/main/tv/compressed'

const SOURCES = {
  tamil:  { url: `${BASE}/countries/in.json`,       lang: 'tam', category: 'tamil',     idStart: 2000 },
  sports: { url: `${BASE}/categories/sports.json`,  lang: null,  category: 'iptvsports', idStart: 3000 },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  const src    = (req.query?.src || 'tamil').toLowerCase()
  const config = SOURCES[src]
  if (!config) return res.status(400).json({ error: `Unknown src: ${src}` })

  try {
    const r = await fetch(config.url, {
      headers: {
        'Accept':   '*/*',
        'User-Agent': 'Mozilla/5.0',
        'Referer':  'https://famelack.com/',
        'Origin':   'https://famelack.com',
      },
    })
    if (!r.ok) throw new Error(`GitHub ${r.status}`)

    // File is stored gzip-compressed (not HTTP Content-Encoding) — always gunzip
    const buf  = Buffer.from(await r.arrayBuffer())
    const data = JSON.parse(gunzipSync(buf).toString('utf-8'))

    const channels = data
      .filter(ch =>
        ch.sources?.streams?.length &&
        (!config.lang || (Array.isArray(ch.languages) && ch.languages.includes(config.lang)))
      )
      .map((ch, i) => ({
        id:           config.idStart + i,
        key:          `famelack_${ch.nanoid}`,
        name:         ch.name,
        url:          ch.sources.streams[0],
        logo:         ch.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase() || 'LIVE',
        logoUrl:      null,
        category:     config.category,
        currentMatch: null,
        isLive:       true,
        badge:        'HD',
        language:     src === 'tamil' ? 'Tamil' : 'English',
        clearKey:     null,
        quality:      ['Auto'],
      }))

    res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300')
    return res.status(200).json(channels)
  } catch (err) {
    console.error('[cf-famelack]', err.message)
    return res.status(502).json([])
  }
}
