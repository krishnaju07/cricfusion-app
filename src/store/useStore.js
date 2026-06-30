import { create } from 'zustand'
import {
  STATIC_CHANNELS,
  DYNAMIC_CHANNEL_IDS, mapDynamicChannel, mapFanCodeChannel, mapSonyLivChannel,
  mapFifaChannel, mapStarSonyChannel,
} from '../data/channels'
import { EXTRA_CHANNELS } from '../data/extra-channels'
import { IPTV_TAMIL_CHANNELS } from '../data/iptv-tamil'
import { parseM3u, mapM3uChannel } from '../utils/parseM3u'
import { isDevToolsOpen } from '../utils/devtools-guard'
import { FEATURES } from '../config/features'

// Geo-locked German hosts (Sportdigital Fussball on t-online/Akamai).
// DISABLED: routing these through /cf-geo only works with a residential German
// proxy (GEO_PROXY_URL) — Akamai 403s datacenter IPs. Until that's set up, leave
// the URLs untouched so they play DIRECTLY: a user with a German VPN on can watch
// them as normal. To re-enable server-side geo routing, restore the .replace()
// below and set GEO_PROXY_URL in Vercel. See api/cf-geo.js.
const GEO_HOSTS = /^https:\/\/(svc4[0-9]\.main\.sl\.t-online\.de)\//
function routeGeoChannel(ch) {
  // Pass-through for now (direct URL → works with the user's own VPN).
  return ch
}

const DYNAMIC_PROXY = '/cf-dynamic'   // SW → japiweb.vercel.app/api/main?id=... (s1-s5) or newwwwapiiiiii
const FANCODE_PROXY = '/cf-fancode'   // SW → github drmlive/fancode-live-events
const SONYLIV_PROXY = '/cf-sonyliv'   // SW → github drmlive/sliv-live-events
const FIFA_PROXY    = '/cf-fifa'      // SW → /api/cf-fifa (server-side, Referer-locked)
const IPTV_PROXY    = '/cf-iptv'      // SW → /api/cf-iptv (iptv-eldbert FIFA channels)
const CXFUT_PROXY       = '/cf-cxfut'       // SW → /api/cf-cxfut (lchdxfootball premium.js HLS)
const FOOTSTERS_PROXY   = '/cf-footsters'   // SW → /api/cf-footsters (footsters-live + footsters-tv redirect-resolved HLS)
const FOOTBALLAPI_PROXY = '/cf-footballapi' // SW → /api/cf-footballapi (footballapi-delta — all FIFA streams, Origin-gated)
const DRMLIVE_M3U = 'https://la.drmlive.net/tp/playlist' // routed via m3u-proxy (Tivimate UA, avoids bot detection)
// Star/Sony Sports: Jio CDN DASH + ClearKey + short-lived token. CORS-open, so
// fetched directly (no SW proxy needed).
const STARSONY_URL  = 'https://sayan-json-4.pages.dev/Data/sports.json'

// SW base64-encodes responses; decode back to JSON string.
// Falls back to plain JSON when SW is active but an old SW version fell
// through to the Vite proxy (which returns raw JSON, not base64).
function decode(text, swActive) {
  if (!text || text === 'error') return null
  try {
    // Always try base64 first (SW encodes all responses); fall back to raw JSON
    try {
      return JSON.parse(decodeURIComponent(escape(atob(text.trim()))))
    } catch {
      return JSON.parse(text)
    }
  } catch {
    return null
  }
}

function ls(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v } catch { return fallback }
}

export const useStore = create((set, get) => ({
  // ── Theme ──────────────────────────────────────────────────────────────
  darkMode: ls('cf_darkMode', 'true') !== 'false',
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    try { localStorage.setItem('cf_darkMode', String(next)) } catch {}
    return { darkMode: next }
  }),

  // ── Notifications ──────────────────────────────────────────────────────
  notificationsEnabled: ls('cf_notifications', '0') === '1',
  toggleNotifications: async () => {
    const { notificationsEnabled } = get()
    if (notificationsEnabled) {
      try { localStorage.setItem('cf_notifications', '0') } catch {}
      set({ notificationsEnabled: false })
      return
    }
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      try { localStorage.setItem('cf_notifications', '1') } catch {}
      set({ notificationsEnabled: true })
      new Notification('CricFusion', {
        body: "You'll be notified when streams go live.",
        icon: '/favicon.svg',
      })
    }
  },

  // ── Stream quality preference ──────────────────────────────────────────
  preferredQuality: ls('cf_quality', 'Auto'),
  setPreferredQuality: (q) => {
    try { localStorage.setItem('cf_quality', q) } catch {}
    set({ preferredQuality: q })
  },

  // ── Favourites ─────────────────────────────────────────────────────────
  favorites: (() => { try { return JSON.parse(localStorage.getItem('cf_favorites') || '[]') } catch { return [] } })(),
  toggleFavorite: (id) => set((s) => {
    const next = s.favorites.includes(id)
      ? s.favorites.filter((f) => f !== id)
      : [...s.favorites, id]
    try { localStorage.setItem('cf_favorites', JSON.stringify(next)) } catch {}
    return { favorites: next }
  }),

  // ── Custom M3U playlist ────────────────────────────────────────────────
  m3uUrl: ls('cf_m3uUrl', ''),
  setM3uUrl: (url) => {
    try { localStorage.setItem('cf_m3uUrl', url) } catch {}
    set({ m3uUrl: url, lastFetched: null })
  },
  // Pasted M3U text — parsed client-side, no server fetch (bypasses bot-detection)
  m3uContent: ls('cf_m3uContent', ''),
  setM3uContent: (text) => {
    try { localStorage.setItem('cf_m3uContent', text) } catch {}
    set({ m3uContent: text, lastFetched: null })
  },

  // ── Tata Play credentials (OTP login) ─────────────────────────────────
  tpCreds: (() => { try { return JSON.parse(localStorage.getItem('cf_tpCreds') || 'null') } catch { return null } })(),
  setTpCreds: (creds) => {
    try { localStorage.setItem('cf_tpCreds', JSON.stringify(creds)) } catch {}
    set({ tpCreds: creds, lastFetched: null })
  },
  clearTpCreds: () => {
    try { localStorage.removeItem('cf_tpCreds') } catch {}
    set({ tpCreds: null, lastFetched: null })
  },

  // ── Channels (loaded from API) ─────────────────────────────────────────
  channels: [...STATIC_CHANNELS, ...EXTRA_CHANNELS, ...(FEATURES.IPTV_TAMIL ? IPTV_TAMIL_CHANNELS : [])],  // start with static; dynamic channels loaded at runtime
  channelsLoading: false,
  channelsError: null,
  lastFetched: null,

  loadChannels: async () => {
    const ownerMode = localStorage.getItem('cf_dev') === '1'
    if (!ownerMode && isDevToolsOpen()) return

    const { channelsLoading, lastFetched } = get()
    if (channelsLoading) return
    if (lastFetched && Date.now() - lastFetched < 5 * 60 * 1000) return

    set({ channelsLoading: true, channelsError: null })

    // SW controller may be null on first load even after serviceWorker.ready
    // (clients.claim() propagates async). Fall back to direct URLs so channels
    // always load; SW proxy kicks in on second+ page load.
    const swActive  = !!(navigator.serviceWorker?.controller)
    const fanCodeUrl = swActive ? FANCODE_PROXY : 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json'
    const sonyLivUrl = swActive ? SONYLIV_PROXY : 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json'
    const dynUrl    = (id) => swActive
      ? `${DYNAMIC_PROXY}?id=${id}`
      : `https://japiweb.vercel.app/api/main?id=${id}`

    // Per-source channel buckets. Each API writes its slice here as it
    // resolves; commit() re-merges in a stable order so a slow endpoint never
    // blocks the others from rendering.
    const sources = {
      wc2026:   [],
      dynamic:  [],
      fifa:     [],
      fancode:  [],
      sonyliv:  [],
      starsony: [],
      drmlive:  [],
      tp:       [],
      m3u:      [],
      sports:   [],
      tamil:    [],
    }
    // Fixed render order — independent of which fetch finishes first.
    const ORDER = ['wc2026', 'dynamic', 'fifa', 'fancode', 'sonyliv', 'starsony', 'drmlive', 'tp', 'm3u', 'sports', 'tamil']

    const commit = (extra = {}) => {
      const allChannels = [
        ...ORDER.flatMap((k) => sources[k]),
        ...STATIC_CHANNELS,
        ...EXTRA_CHANNELS,
        ...(FEATURES.IPTV_TAMIL ? IPTV_TAMIL_CHANNELS : []),
      ]
      const seen = new Set()
      const deduped = allChannels.filter((ch) => {
        if (seen.has(ch.key)) return false
        seen.add(ch.key)
        return true
      }).map(routeGeoChannel)
      set({ channels: deduped, ...extra })
    }

    // Each source updates its bucket then commits independently, so channels
    // appear as soon as their own API responds — the slowest one no longer
    // holds back the rest.
    const tasks = []

    // ── FanCode live events ────────────────────────────────────────────
    tasks.push(
      fetch(fanCodeUrl).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        sources.fancode = (json?.matches || [])
          .filter((m) => m.status === 'LIVE' && (m.adfree_url || m.dai_url))
          .map(mapFanCodeChannel)
        commit()
      }).catch((e) => console.warn('FanCode load failed:', e))
    )

    // ── Sony LIV live events ───────────────────────────────────────────
    tasks.push(
      fetch(sonyLivUrl).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        sources.sonyliv = (json?.matches || [])
          .filter((m) => m.isLive && (m.dai_url || m.pub_url || m.video_url))
          .map((m, i) => mapSonyLivChannel(m, 300 + i + 1))
        commit()
      }).catch((e) => console.warn('Sony LIV load failed:', e))
    )

    // ── WC 2026 Live — footballapi-delta (own section) ───────────────────
    tasks.push(
      fetch(FOOTBALLAPI_PROXY).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        sources.wc2026 = (Array.isArray(json) ? json : []).map(mapFifaChannel)
        commit()
      }).catch((e) => console.warn('Football API load failed:', e))
    )

    // ── FIFA 2026 + iptv-eldbert + cxfut + footsters streams ─────────────
    // Four endpoints feed the same bucket; merge whichever arrives first.
    let fifaPart = [], iptvPart = [], cxfutPart = [], footstersPart = []
    const commitFifa = () => { sources.fifa = [...fifaPart, ...cxfutPart, ...footstersPart, ...iptvPart]; commit() }
    tasks.push(
      fetch(FIFA_PROXY).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        fifaPart = (Array.isArray(json) ? json : []).map(mapFifaChannel)
        commitFifa()
      }).catch((e) => console.warn('FIFA load failed:', e))
    )
    tasks.push(
      fetch(CXFUT_PROXY).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        cxfutPart = (Array.isArray(json) ? json : []).map(mapFifaChannel)
        commitFifa()
      }).catch((e) => console.warn('CXFUT FIFA load failed:', e))
    )
    tasks.push(
      fetch(IPTV_PROXY).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        iptvPart = (Array.isArray(json) ? json : []).map(mapFifaChannel)
        commitFifa()
      }).catch((e) => console.warn('IPTV FIFA load failed:', e))
    )
    tasks.push(
      fetch(FOOTSTERS_PROXY).then((r) => r.text()).then((text) => {
        const json = decode(text, swActive)
        footstersPart = (Array.isArray(json) ? json : []).map(mapFifaChannel)
        commitFifa()
      }).catch((e) => console.warn('Footsters load failed:', e))
    )

    // ── Star / Sony Sports (sayan-json-4) ──────────────────────────────
    tasks.push(
      fetch(STARSONY_URL, { cache: 'no-store' }).then((r) => r.json()).then((json) => {
        sources.starsony = (json?.channels || [])
          .map((c, i) => mapStarSonyChannel(c, 1000 + i + 1))
          .filter(Boolean)
        commit()
      }).catch((e) => console.warn('Star/Sony load failed:', e))
    )

    // ── Per-channel dynamic channels ───────────────────────────────────
    DYNAMIC_CHANNEL_IDS.forEach((id, i) => {
      tasks.push(
        fetch(dynUrl(id)).then((r) => r.text()).then((text) => {
          const data = decode(text, swActive)
          if (!data || (!data.url && !data.streamUrl)) return
          sources.dynamic[i] = mapDynamicChannel(data, 200 + i + 1, id)
          // strip empty slots from channels that failed/not-yet-arrived
          commit()
        }).catch((e) => console.warn('Dynamic channel load failed:', e))
      )
    })

    // ── la.drmlive.net playlist (Cricket, FIFA WC 2026, Sony, Willow, ICC TV…) ──
    // Routed through /api/m3u-proxy so the Tivimate User-Agent is injected server-side,
    // bypassing Cloudflare bot detection that blocks Node.js native fetch.
    if (FEATURES.DRMLIVE) {
      const DRMLIVE_SPORTS_RE = /sport|cricket|football|soccer|fifa|wc\s*20|tennis|basketball|formula|f1|boxing|wrestling/i
      tasks.push(
        fetch(`/api/m3u-proxy?url=${encodeURIComponent(DRMLIVE_M3U)}`).then((r) => r.text()).then((text) => {
          if (!text.includes('#EXTM3U')) return
          const parsed = parseM3u(text)
          sources.drmlive = parsed
            .filter((ch) => ch.group !== '1-Playlist-Activation' && DRMLIVE_SPORTS_RE.test(ch.group))
            .map((ch, i) => mapM3uChannel(ch, 5000 + i + 1, { keyPrefix: 'dl', sourceLabel: 'DRMLive' }))
          commit()
        }).catch((e) => console.warn('DRMLive playlist load failed:', e))
      )
    }

    // ── Tata Play (native OTP login — loads all channels from API) ────────
    if (FEATURES.TATAPLAY) {
      const tpCreds = get().tpCreds
      if (tpCreds?.subscriberId && tpCreds?.userAuthenticateToken) {
        tasks.push(
          fetch(`/api/tp-channels?sub=${encodeURIComponent(tpCreds.subscriberId)}&tok=${encodeURIComponent(tpCreds.userAuthenticateToken)}`)
            .then((r) => r.json()).then((tpData) => {
              sources.tp = tpData.channels || []
              commit()
            }).catch((e) => console.warn('Tata Play channels load failed:', e))
        )
      }
    }

    // ── Custom M3U playlist ───────────────────────────────────────────────
    // m3uContent (pasted text) takes priority — parsed client-side, no fetch.
    // m3uUrl falls back to proxy fetch (only works for non-bot-protected URLs).
    const m3uUrl     = get().m3uUrl
    const m3uContent = get().m3uContent
    const buildM3u = (parsed) => parsed
      .filter((ch) => !sources.tp.length || !ch.licenseServer?.includes('tp.drmlive-01.workers.dev'))
      .map((ch, i) => ({ ...mapM3uChannel(ch, 400 + i + 1, { keyPrefix: 'm3u', sourceLabel: 'Custom' }), category: 'playlist' }))

    if (m3uContent) {
      sources.m3u = buildM3u(parseM3u(m3uContent))
      commit()
    } else if (m3uUrl) {
      tasks.push(
        fetch(`/api/m3u-proxy?url=${encodeURIComponent(m3uUrl)}`).then((r) => r.text()).then((text) => {
          sources.m3u = buildM3u(parseM3u(text))
          commit()
        }).catch((e) => console.warn('M3U load failed:', e))
      )
    }

    // ── Global sports channels (famelack sports) ──────────────────────────
    if (FEATURES.IPTV_SPORTS) {
      tasks.push(
        fetch('/api/cf-famelack?src=sports').then((r) => r.json()).then((json) => {
          sources.sports = Array.isArray(json) ? json : []
          commit()
        }).catch((e) => console.warn('IPTV Sports load failed:', e))
      )
    }

    // ── Tamil channels (famelack India API) — only add channels not already
    //    covered by the static IPTV_TAMIL_CHANNELS list (avoids duplicates).
    if (FEATURES.IPTV_TAMIL) {
      const staticTamilNames = new Set(
        IPTV_TAMIL_CHANNELS.map((ch) =>
          ch.name.replace(/\s*\([^)]+\)\s*/g, '').trim().toLowerCase()
        )
      )
      tasks.push(
        fetch('/api/cf-famelack?src=tamil').then((r) => r.json()).then((json) => {
          sources.tamil = (Array.isArray(json) ? json : []).filter(
            (ch) => !staticTamilNames.has(ch.name.replace(/\s*\([^)]+\)\s*/g, '').trim().toLowerCase())
          )
          commit()
        }).catch((e) => console.warn('Tamil channels load failed:', e))
      )
    }

    // Clear the loading flag once everything has settled (errors already
    // handled per-task), but channels were rendered progressively above.
    try {
      await Promise.allSettled(tasks)
      // dynamic bucket may have holes from failed ids — compact before final commit
      sources.dynamic = sources.dynamic.filter(Boolean)
      commit({ channelsLoading: false, lastFetched: Date.now() })
    } catch (err) {
      console.error('Failed to load channels:', err)
      set({ channelsLoading: false, channelsError: err.message })
    }
  },

  refreshChannels: () => {
    set({ lastFetched: null })
    get().loadChannels()
  },

  // Hard refresh: force the service worker to update and reload the page so a
  // brand-new SW re-fetches fresh tokenized stream data (fixes stale "Token
  // expired" URLs cached at the SW / upstream edge). Heavier than refreshChannels.
  hardRefresh: async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.update().catch(() => {})))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {}
    window.location.reload()
  },

  // ── Navigation state ───────────────────────────────────────────────────
  currentChannel: null,
  setCurrentChannel: (ch) => set({ currentChannel: ch }),

  activeCategory: ls('cf_category', 'all'),
  setActiveCategory: (cat) => {
    try { localStorage.setItem('cf_category', cat) } catch {}
    set({ activeCategory: cat })
  },

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}))
