import { create } from 'zustand'
import {
  CHANNEL_ORDER, STATIC_CHANNELS, mapApiChannel,
  DYNAMIC_CHANNEL_IDS, mapDynamicChannel, mapFanCodeChannel, mapSonyLivChannel,
  mapFifaChannel,
} from '../data/channels'
import { IPTV_SPORTS_CHANNELS } from '../data/iptv-sports'
import { IPTV_TAMIL_CHANNELS } from '../data/iptv-tamil'
import { parseM3u, mapM3uChannel } from '../utils/parseM3u'
import { isDevToolsOpen } from '../utils/devtools-guard'
import { FEATURES } from '../config/features'

const PROXY         = '/cf-data'      // SW → jtvv.pages.dev/channels.json
const DYNAMIC_PROXY = '/cf-dynamic'   // SW → newwwwapiiiiii.vercel.app/main?id=...
const FANCODE_PROXY = '/cf-fancode'   // SW → github drmlive/fancode-live-events
const SONYLIV_PROXY = '/cf-sonyliv'   // SW → github drmlive/sliv-live-events
const FIFA_PROXY    = '/cf-fifa'      // SW → /api/cf-fifa (server-side, Referer-locked)

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
  channels: [...STATIC_CHANNELS, ...IPTV_SPORTS_CHANNELS, ...(FEATURES.IPTV_TAMIL ? IPTV_TAMIL_CHANNELS : [])],  // start with static; FIFA + API channels loaded at runtime
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
    const batchUrl  = swActive ? PROXY : 'https://jtvv.pages.dev/channels.json'
    const fanCodeUrl = swActive ? FANCODE_PROXY : 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json'
    const sonyLivUrl = swActive ? SONYLIV_PROXY : 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json'
    const fifaUrl   = FIFA_PROXY  // always via SW or direct — no public fallback (Referer-locked)
    const dynUrl    = (id) => swActive
      ? `${DYNAMIC_PROXY}?id=${id}`
      : `https://newwwwapiiiiii.vercel.app/main?id=${id}`

    try {
      // Fire all APIs in parallel — SW proxies so real URLs stay hidden
      const [batchResult, fanCodeResult, sonyLivResult, fifaResult, ...dynamicResults] = await Promise.allSettled([
        fetch(batchUrl).then((r) => r.text()),
        fetch(fanCodeUrl).then((r) => r.text()),
        fetch(sonyLivUrl).then((r) => r.text()),
        fetch(fifaUrl).then((r) => r.text()),
        ...DYNAMIC_CHANNEL_IDS.map((id) => fetch(dynUrl(id)).then((r) => r.text())),
      ])

      // ── Batch channels (jtvv) ──────────────────────────────────────────
      let apiChannels = []
      if (batchResult.status === 'fulfilled') {
        const json = decode(batchResult.value, swActive)
        if (json) {
          const ordered = [
            ...CHANNEL_ORDER,
            ...Object.keys(json).filter((k) => !CHANNEL_ORDER.includes(k)),
          ]
          apiChannels = ordered
            .filter((key) => json[key])
            .map((key, i) => mapApiChannel(key, json[key], i + 1))
        }
      }

      // ── FanCode live events ────────────────────────────────────────────
      let fanCodeChannels = []
      if (fanCodeResult.status === 'fulfilled') {
        const json = decode(fanCodeResult.value, swActive)
        fanCodeChannels = (json?.matches || [])
          .filter((m) => m.status === 'LIVE' && (m.adfree_url || m.dai_url))
          .map(mapFanCodeChannel)
      }

      // ── Sony LIV live events ───────────────────────────────────────────
      let sonyLivChannels = []
      if (sonyLivResult.status === 'fulfilled') {
        const json = decode(sonyLivResult.value, swActive)
        sonyLivChannels = (json?.matches || [])
          .filter((m) => m.isLive && (m.dai_url || m.pub_url || m.video_url))
          .map((m, i) => mapSonyLivChannel(m, 300 + i + 1))
      }

      // ── FIFA 2026 streams (server-side, Referer-locked) ───────────────
      let fifaChannels = []
      if (fifaResult.status === 'fulfilled') {
        const json = decode(fifaResult.value, swActive)
        fifaChannels = (Array.isArray(json) ? json : []).map(mapFifaChannel)
      }

      // ── Per-channel dynamic channels ───────────────────────────────────
      const dynamicChannels = dynamicResults
        .map((result, i) => {
          if (result.status !== 'fulfilled') return null
          const data = decode(result.value, swActive)
          if (!data || !data.url) return null
          return mapDynamicChannel(data, 200 + i + 1)
        })
        .filter(Boolean)

      // ── Tata Play (native OTP login — loads all channels from API) ────────
      let tpApiChannels = []
      if (FEATURES.TATAPLAY) {
        const tpCreds = get().tpCreds
        if (tpCreds?.subscriberId && tpCreds?.userAuthenticateToken) {
          try {
            const tpResp = await fetch(
              `/api/tp-channels?sub=${encodeURIComponent(tpCreds.subscriberId)}&tok=${encodeURIComponent(tpCreds.userAuthenticateToken)}`
            )
            const tpData = await tpResp.json()
            tpApiChannels = tpData.channels || []
          } catch (e) {
            console.warn('Tata Play channels load failed:', e)
          }
        }
      }

      // ── Custom M3U playlist (fallback for non-TP IPTV sources) ────────────
      let m3uChannels = []
      const m3uUrl = get().m3uUrl
      if (m3uUrl) {
        try {
          const text = await fetch(`/api/m3u-proxy?url=${encodeURIComponent(m3uUrl)}`).then((r) => r.text())
          const parsed = parseM3u(text)
          m3uChannels = parsed
            .filter((ch) => !tpApiChannels.length || !ch.licenseServer?.includes('tp.drmlive-01.workers.dev'))
            .map((ch, i) => mapM3uChannel(ch, 400 + i + 1))
        } catch (e) {
          console.warn('M3U load failed:', e)
        }
      }

      const allChannels = [...apiChannels, ...dynamicChannels, ...STATIC_CHANNELS, ...fifaChannels, ...fanCodeChannels, ...sonyLivChannels, ...tpApiChannels, ...m3uChannels, ...IPTV_SPORTS_CHANNELS, ...(FEATURES.IPTV_TAMIL ? IPTV_TAMIL_CHANNELS : [])]
      const seen = new Set()
      const deduped = allChannels.filter((ch) => {
        if (seen.has(ch.key)) return false
        seen.add(ch.key)
        return true
      })
      set({
        channels: deduped,
        channelsLoading: false,
        lastFetched:     Date.now(),
      })
    } catch (err) {
      console.error('Failed to load channels:', err)
      set({ channelsLoading: false, channelsError: err.message })
    }
  },

  refreshChannels: () => {
    set({ lastFetched: null })
    get().loadChannels()
  },

  // ── Navigation state ───────────────────────────────────────────────────
  currentChannel: null,
  setCurrentChannel: (ch) => set({ currentChannel: ch }),

  activeCategory: 'all',
  setActiveCategory: (cat) => set({ activeCategory: cat }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
}))
