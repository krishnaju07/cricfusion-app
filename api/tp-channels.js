// Fetches the full Tata Play channel list from the Cloudflare origin worker
// and maps it to CricFusion channel schema.
// bpaita-domain channels are routed through /api/tp-mpd (needs auth).
// Other channels are routed through /api/tp-mpd-proxy (just injects ClearKey).
const GENRE_MAP = {
  Cricket: 'cricket', Football: 'football', Tennis: 'tennis',
  Badminton: 'cricket', Hockey: 'cricket', Kabaddi: 'cricket',
  Wrestling: 'boxing', Boxing: 'boxing',
  Sports: 'cricket', Basketball: 'basketball',
  'Formula 1': 'formula1', Motorsport: 'formula1',
}

function mapGenre(genres = []) {
  const filtered = genres.filter((g) => g !== 'HD')
  for (const g of filtered) {
    if (GENRE_MAP[g]) return GENRE_MAP[g]
  }
  return 'multi'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const { sub: subscriberId, tok: token } = req.query

  try {
    const r = await fetch('https://tp.drmlive-01.workers.dev/origin', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    })
    if (!r.ok) return res.status(r.status).json({ error: 'Origin API failed' })
    const data = await r.json()
    const list = data.data?.list || []

    // Skip DistroTV channels and channels with no stream data
    const channels = list
      .filter((ch) => ch.provider !== 'DistroTV' && ch.streamData?.dashWidewinePlayUrl)
      .map((ch, i) => {
        const dashUrl = ch.streamData.dashWidewinePlayUrl
        let isBpaita = false
        try { isBpaita = new URL(dashUrl).hostname.startsWith('bpaita') } catch {}

        const url = isBpaita
          ? `/api/tp-mpd?id=${ch.id}&sub=${encodeURIComponent(subscriberId || '')}&tok=${encodeURIComponent(token || '')}`
          : `/api/tp-mpd-proxy?url=${encodeURIComponent(dashUrl)}`

        const isHd = (ch.genres || []).includes('HD')

        return {
          id:           `tp_${ch.id}`,
          key:          `tp_${ch.id}`,
          name:         ch.title,
          category:     mapGenre(ch.genres),
          currentMatch: ch.title,
          thumbnail:    ch.transparentImageUrl || null,
          logo:         ch.title.replace(/\s+(HD|SD)\s*$/i, '').slice(0, 4).toUpperCase(),
          isLive:       true,
          viewers:      '—',
          badge:        isHd ? 'HD' : 'SD',
          language:     'Hindi',
          description:  `${ch.title} — Tata Play`,
          score:        null,
          url,
          clearKey:     null,
          drmSystem:    'clearkey',
          licenseServer: `/api/tp-license?id=${ch.id}`,
          reqHeaders:   null,
          quality:      ['Auto'],
        }
      })

    return res.status(200).json({ channels, total: channels.length })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
