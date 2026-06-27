import { useRef, useState, useEffect, useCallback } from 'react'
import Hls from 'hls.js'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Lock, LockOpen, Sun, Volume2 as VolumeSwipeIcon, Wifi, WifiOff } from 'lucide-react'
import PlayerControls from './PlayerControls'
import SettingsMenu from './SettingsMenu'
import SeekIndicator from './SeekIndicator'
import SubtitleOverlay from './SubtitleOverlay'
import { useStore } from '../../store/useStore'

const LANG_NAMES = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi', pa: 'Punjabi', bn: 'Bengali', und: 'Default', mul: 'Multi' }
function formatLangLabel(code) {
  if (!code) return 'Audio'
  return LANG_NAMES[code.toLowerCase()] || code.toUpperCase()
}

// Extract the __hdnea__ token from a Jio CDN URL to re-append on segment requests
function extractToken(url) {
  const match = url.match(/[?&](__hdnea__=[^&]+)/)
  return match ? match[1] : null
}

// Strips Widevine PSSH boxes from binary MP4 init segments.
// Shaka reads PSSH boxes from init segments and tries to initialise the matching
// CDM (Widevine = edef8ba9-…). Removing them prevents the Widevine CDM attempt
// while leaving the encryption parameters intact for ClearKey.
function stripWidevinePssh(input) {
  try {
    const src = input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset ?? 0, input.byteLength)

    const u32 = (a, i) => ((a[i] << 24) | (a[i+1] << 16) | (a[i+2] << 8) | a[i+3]) >>> 0

    function process(a, start, end) {
      const chunks = []; let pos = start
      while (pos + 8 <= end) {
        const sz = u32(a, pos)
        if (sz < 8 || pos + sz > end) break
        const t = String.fromCharCode(a[pos+4], a[pos+5], a[pos+6], a[pos+7])
        // Skip Widevine PSSH: system ID at pos+12 starts with ed ef 8b a9
        if (t === 'pssh' && sz >= 28 &&
            a[pos+12] === 0xed && a[pos+13] === 0xef && a[pos+14] === 0x8b && a[pos+15] === 0xa9) {
          pos += sz; continue
        }
        // Recurse into moov to catch nested PSSH
        if (t === 'moov') {
          const inner = process(a, pos + 8, pos + sz)
          const nSz = 8 + inner.length
          const box = new Uint8Array(nSz)
          box[0] = (nSz >>> 24) & 0xFF; box[1] = (nSz >>> 16) & 0xFF
          box[2] = (nSz >>> 8) & 0xFF;  box[3] = nSz & 0xFF
          box[4] = 0x6D; box[5] = 0x6F; box[6] = 0x6F; box[7] = 0x76  // 'moov'
          box.set(inner, 8); chunks.push(box); pos += sz; continue
        }
        chunks.push(a.slice(pos, pos + sz)); pos += sz
      }
      let total = 0; for (const c of chunks) total += c.length
      const out = new Uint8Array(total); let off = 0
      for (const c of chunks) { out.set(c, off); off += c.length }
      return out
    }

    return process(src, 0, src.length).buffer
  } catch { return input }
}

// Derive an HLS URL from a DASH MPD URL for Safari native playback.
// Amazon IVS and CMAF CDNs always expose parallel HLS endpoints.
function deriveSafariHlsUrl(mpd) {
  if (!mpd) return null
  // Amazon IVS: /clients/dash/enc/.../cenc.mpd → /clients/hls/enc/.../index.m3u8
  if (mpd.includes('/clients/dash/enc/')) {
    return mpd.replace('/clients/dash/enc/', '/clients/hls/enc/').replace(/\/cenc\.mpd$/, '/index.m3u8')
  }
  // Generic CMAF: master.mpd → master.m3u8, index.mpd → index.m3u8
  if (mpd.endsWith('master.mpd')) return mpd.replace('master.mpd', 'master.m3u8')
  if (mpd.endsWith('index.mpd'))  return mpd.replace('index.mpd',  'index.m3u8')
  // Last-resort: many CDNs (bitgravity, Sun Direct, etc.) serve parallel HLS at .m3u8
  if (mpd.endsWith('.mpd')) return mpd.replace(/\.mpd$/, '.m3u8')
  return null
}

function QualityWifi({ quality, actualHeight }) {
  const h = actualHeight || parseInt(quality) || 0
  const color = h >= 1080 ? '#22c55e' : h >= 720 ? '#84cc16' : h >= 480 ? '#f59e0b' : h > 0 ? '#ef4444' : '#ffffff40'
  const tip = actualHeight && quality === 'Auto' ? `Auto · playing ${actualHeight}p` : `Stream quality: ${quality}`
  return <Wifi size={14} style={{ color, transition: 'color 0.4s' }} title={tip} />
}

export default function VideoPlayer({ channel, onLockChange, onBack }) {
  const videoRef    = useRef(null)
  const hlsRef      = useRef(null)
  const shakaRef    = useRef(null)
  const containerRef = useRef(null)
  const hideTimer   = useRef(null)
  const seekIndicatorTimer = useRef(null)
  const waitingTimer = useRef(null)   // debounces the loading spinner on brief stalls
  const clickTimer  = useRef(null)
  const liveRef     = useRef({})   // always-fresh mirror of state for closures
  const gestureRef  = useRef({ active: false, isSwipe: false, side: null, startY: 0, startValue: 0, pinchActive: false, pinchDist: 0, startZoom: 1 })
  const swipeHideTimer = useRef(null)
  const speechRef          = useRef(null)   // SpeechRecognition instance
  const finalTextRef       = useRef('')     // accumulated final speech text
  const subtitleTrackClean = useRef(null)   // cleanup fn for active TextTrack listener
  const subClearTimer      = useRef(null)   // clears subtitle text after silence gap
  const fallbackTriedRef   = useRef(false)  // true once fallbackUrl has been attempted
  const preferredQualityApplied = useRef(false)
  const recoverAttempts    = useRef(0)      // token-expiry auto-refetch attempts (reset on channel switch / successful play)

  const { preferredQuality, refreshChannels } = useStore()

  // Reset recovery budget when switching to a different channel (not on token reloads).
  useEffect(() => { recoverAttempts.current = 0 }, [channel?.id])

  const [streamTracks, setStreamTracks] = useState([])   // detected text tracks from stream
  const [castAvailable, setCastAvailable]   = useState(false)
  const [casting, setCasting]               = useState(false)
  const [castPhase, setCastPhase]           = useState('idle')   // idle | connecting | connected
  const [devicesPresent, setDevicesPresent] = useState(false)    // any Cast receiver visible on the network
  const [castHint, setCastHint]             = useState(false)    // show "VPN blocking TV" guide
  const [airPlayAvailable, setAirPlayAvailable] = useState(false)
  const [shakaReady, setShakaReady] = useState(() => typeof window !== 'undefined' && !!window.__shakaReady)

  // Shaka is loaded deferred (non-blocking). If a DASH stream is requested
  // before it finishes, wait for the 'shakaready' event then re-run setup.
  useEffect(() => {
    if (shakaReady) return
    const onReady = () => setShakaReady(true)
    window.addEventListener('shakaready', onReady, { once: true })
    return () => window.removeEventListener('shakaready', onReady)
  }, [shakaReady])

  const [state, setState] = useState({
    playing: false,
    muted: false,
    volume: 0.8,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    fullscreen: false,
    pip: false,
    showControls: true,
    loading: true,
    error: null,
    quality: 'Auto',
    actualHeight: 0,   // real playing height regardless of Auto/manual
    qualityLevels: [],
    showQualityMenu: false,
    enhance: false,
    seekIndicator: null,
    isLive: false,
    locked: false,
    objectFit: 'contain',   // 'contain' | 'cover' | 'fill'
    zoom: 1,                // pinch zoom scale
    brightness: 1,          // CSS filter brightness (0.1 – 2.0)
    swipeIndicator: null,   // { type, barValue, displayValue, side }
    subtitleMode: null,     // null | { type: 'track', index } | { type: 'speech' }
    subtitleText: '',       // current subtitle line(s) to display
    subtitleInterim: '',    // interim speech text (lighter colour)
    audioTracks: [],        // [{ id: string, label: string }]
    audioTrack: null,       // string id of active audio track
  })

  const update = useCallback((patch) => {
    setState((s) => {
      const next = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }
      liveRef.current = next
      if ('locked' in (typeof patch === 'function' ? {} : patch)) {
        onLockChange?.(next.locked)
      }
      return next
    })
  }, [onLockChange])

  // ── Chromecast init ───────────────────────────────────────────────────
  useEffect(() => {
    const init = () => {
      try {
        const { cast, chrome } = window
        cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        })
        const ctx = cast.framework.CastContext.getInstance()

        // Track whether any receiver is reachable. With a VPN on, local mDNS
        // discovery is tunneled away and this stays NO_DEVICES_AVAILABLE.
        const syncCastState = () => {
          const s = ctx.getCastState()
          setDevicesPresent(s !== cast.framework.CastState.NO_DEVICES_AVAILABLE)
        }
        ctx.addEventListener(
          cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          syncCastState
        )
        syncCastState()

        ctx.addEventListener(
          cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (e) => {
            const active =
              e.sessionState === cast.framework.SessionState.SESSION_STARTED ||
              e.sessionState === cast.framework.SessionState.SESSION_RESUMED
            setCasting(active)
            setCastPhase(active ? 'connected' : 'idle')
            if (active) setCastHint(false)
            // Re-attach our media after a dropped/resumed session so the TV
            // keeps showing the right channel instead of a stale receiver app.
            if (e.sessionState === cast.framework.SessionState.SESSION_RESUMED) {
              loadCastMediaRef.current?.(ctx.getCurrentSession())
            }
          }
        )
        setCastAvailable(true)
      } catch {}
    }
    if (window.__castReady) init()
    else window.addEventListener('castready', init, { once: true })
    return () => window.removeEventListener('castready', init)
  }, [])

  // ── AirPlay availability ──────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const handler = (e) => setAirPlayAvailable(e.availability === 'available')
    v.addEventListener('webkitplaybacktargetavailabilitychanged', handler)
    return () => v.removeEventListener('webkitplaybacktargetavailabilitychanged', handler)
  }, [])

  // Builds the LoadRequest for the current channel and pushes it to a session.
  const loadCastMedia = useCallback(async (session) => {
    if (!session || !channel?.url) return
    const { chrome } = window
    const url = channel.url.startsWith('/')
      ? `${window.location.origin}${channel.url}`
      : channel.url
    const mimeType = (url.includes('.mpd') || url.includes('/api/cf-m6')) ? 'application/dash+xml' : 'application/x-mpegURL'

    const mediaInfo = new chrome.cast.media.MediaInfo(url, mimeType)
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata()
    mediaInfo.metadata.title = channel.name || 'CricFusion'
    mediaInfo.metadata.subtitle = channel.currentMatch || ''
    if (channel.thumbnail) mediaInfo.metadata.images = [new chrome.cast.Image(channel.thumbnail)]

    await session.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo))
  }, [channel])

  // Keep a stable ref so the once-mounted Cast listeners always reload the
  // latest channel after a session resume.
  const loadCastMediaRef = useRef(loadCastMedia)
  useEffect(() => { loadCastMediaRef.current = loadCastMedia }, [loadCastMedia])

  const startCast = useCallback(async () => {
    if (!channel?.url) return
    setCastHint(false)
    try {
      const { cast } = window
      const ctx = cast.framework.CastContext.getInstance()
      if (ctx.getSessionState() === cast.framework.SessionState.NO_SESSION) {
        setCastPhase('connecting')
        await ctx.requestSession()
      }
      const session = ctx.getCurrentSession()
      if (!session) { setCastPhase('idle'); return }

      await loadCastMedia(session)
      setCastPhase('connected')
    } catch (err) {
      setCastPhase('idle')
      // 'cancel' = user closed the picker; anything else (esp. no receiver
      // found) likely means a VPN is tunneling local discovery away.
      if (err !== 'cancel' && err?.code !== 'cancel') setCastHint(true)
      console.warn('[cast]', err)
    }
  }, [channel, loadCastMedia])

  const stopCast = useCallback(async () => {
    try {
      const session = window.cast?.framework.CastContext.getInstance().getCurrentSession()
      if (session) await session.endSession(true)
    } catch {}
  }, [])

  const toggleCast = useCallback(() => {
    casting ? stopCast() : startCast()
  }, [casting, startCast, stopCast])

  const toggleAirPlay = useCallback(() => {
    videoRef.current?.webkitShowPlaybackTargetPicker?.()
  }, [])

  // ── Initialise player ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !channel?.url) return

    let isCancelled = false
    let hlsRetryTimer = null
    fallbackTriedRef.current = false
    preferredQualityApplied.current = false
    update({ loading: true, playing: false, error: null, currentTime: 0, duration: 0, qualityLevels: [], isLive: false, quality: 'Auto', subtitleMode: null, subtitleText: '', subtitleInterim: '', audioTracks: [], audioTrack: null })
    setStreamTracks([])

    // Stop any active subtitle session
    clearTimeout(subClearTimer.current)
    const oldR = speechRef.current; speechRef.current = null
    if (oldR) try { oldR.stop() } catch {}
    if (subtitleTrackClean.current) { subtitleTrackClean.current(); subtitleTrackClean.current = null }
    finalTextRef.current = ''

    // Tear down any existing player
    if (hlsRef.current)   { hlsRef.current.destroy();  hlsRef.current  = null }
    if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null }
    video.removeAttribute('src')
    video.load()

    // Token-expiry auto-recovery: the Star/Sony & Sony LIV streams embed a
    // short-lived Akamai hdnea token in the URL. When it expires the CDN returns
    // 401/403 and playback dies with "token expired". Re-fetching the channel
    // JSON mints a fresh token; the updated channel.url flows back via props and
    // re-runs this effect. Guarded so a genuinely-dead stream can't loop forever.
    // No auto-retry: show error immediately and let the user decide.
    const MAX_RECOVERIES = 0
    const tryTokenRecovery = (label) => {
      if (recoverAttempts.current >= MAX_RECOVERIES) return false
      recoverAttempts.current += 1
      update({ error: null, loading: true })
      refreshChannels()
      return true
    }

    const isMPD = channel.url.includes('.mpd') || channel.url.includes('/api/tp-mpd') || channel.url.includes('/api/cf-m6')
    const isHLS = channel.url.includes('.m3u8')

    // ── DASH / MPD via Shaka Player ──
    if (isMPD) {
      // Safari doesn't support DASH or ClearKey DRM — use HLS fallback derived from MPD URL
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      if (isSafari) {
        const safariUrl = channel.safariUrl || deriveSafariHlsUrl(channel.url)
        if (safariUrl) {
          video.src = safariUrl
          video.play().catch(() => { video.muted = true; update({ muted: true }); video.play().catch(() => {}) })
          update({ loading: false, isLive: true })
          return
        }
        update({ error: 'Safari does not support this stream. Please use Chrome or Firefox.', loading: false })
        return
      }

      const shaka = window.shaka
      if (!shaka) {
        // Deferred script not ready yet — stay in loading; the shakaready
        // listener flips shakaReady and re-runs this effect. Only error if it's
        // been long enough that the script genuinely failed to load.
        if (!window.__shakaReady) return
        update({ error: 'Shaka Player not loaded. Check your connection.', loading: false })
        return
      }

      shaka.polyfill.installAll()

      if (!shaka.Player.isBrowserSupported()) {
        update({ error: 'Your browser does not support this stream format.', loading: false })
        return
      }

      const player = new shaka.Player()
      shakaRef.current = player

      const is4K = channel.badge === '4K'

      const dashConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      const dashDownlink = dashConn?.downlink ?? 10
      // Quality ceiling matched to the connection so ABR can't overshoot and stall.
      // 4K channels keep a higher ceiling; everything else is capped to a sustainable tier.
      const dashMaxHeight = is4K ? Infinity : (dashDownlink >= 8 ? 1080 : dashDownlink >= 3 ? 720 : 480)

      // DRM: ClearKey (inline keys or license server)
      const isAndroid = /android/i.test(navigator.userAgent)

      const cfg = {
        streaming: {
          lowLatencyMode:  false,
          // Mobile gets smaller buffers to avoid MediaSource QUOTA_EXCEEDED on low-RAM devices.
          bufferingGoal:   is4K ? 60 : (isAndroid ? 20 : 45),
          rebufferingGoal: is4K ? 6  : (isAndroid ? 3  : 4),
          bufferBehind:    isAndroid ? 30 : 60,
          stallEnabled:    true,
          stallThreshold:  1,
          stallSkip:       0.1,
        },
        abr: {
          enabled: true,
          defaultBandwidthEstimate: 2_500_000,  // conservative start, let ABR ramp up
          bandwidthDowngradeTarget: 0.9,         // drop quality early when bandwidth tightens
          bandwidthUpgradeTarget:   0.7,         // upgrade cautiously to avoid stall-inducing overshoot
        },
        // NOTE: do NOT set restrictions here — Shaka checks them against available tracks
        // during player.load() and throws RESTRICTIONS_CANNOT_BE_SATISFIED (error 3032)
        // if the stream's minimum quality exceeds dashMaxHeight (happens on mobile when
        // navigator.connection.downlink reports a low value). Apply after streaming starts.
        // Android Chrome has inconsistent HEVC/H.265 hardware decode support —
        // prefer H.264 and AAC so Shaka doesn't pick codec combos that stall silently.
        ...(isAndroid && {
          preferredVideoCodecs: ['avc1'],
          preferredAudioCodecs: ['mp4a.40.2', 'mp4a.40.5'],
        }),
      }
      if (channel.clearKey) {
        cfg.drm = {
          clearKeys: { [channel.clearKey.keyId]: channel.clearKey.key },
        }
      } else if (channel.licenseServer) {
        const isWv = channel.drmSystem === 'widevine'
        cfg.drm = {
          servers: { [isWv ? 'com.widevine.alpha' : 'org.w3.clearkey']: channel.licenseServer },
        }
      }

      player.configure(cfg)

      // Request filter: token injection + custom headers (e.g. Tata Play CDN)
      const token = extractToken(channel.url)
      const reqHeaders = channel.reqHeaders || null
      if (token || reqHeaders) {
        player.getNetworkingEngine().registerRequestFilter((type, request) => {
          if (token && type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
            request.uris = request.uris.map((u) =>
              u.includes('?') ? `${u}&${token}` : `${u}?${token}`
            )
          }
          if (reqHeaders) {
            Object.assign(request.headers, reqHeaders)
          }
        })
      }

      // ClearKey channels: two-phase response filter.
      // MANIFEST phase: strip Widevine/PlayReady XML + inject ClearKey ContentProtection.
      // SEGMENT phase:  strip Widevine PSSH boxes from binary MP4 init segments so Shaka
      //   does not fall back to the Widevine CDM when it reads the segment's DRM metadata.
      if (channel.clearKey || channel.drmSystem === 'clearkey') {
        player.getNetworkingEngine().registerResponseFilter((type, response) => {
          const MT = shaka.net.NetworkingEngine.RequestType.MANIFEST
          const ST = shaka.net.NetworkingEngine.RequestType.SEGMENT

          if (type === MT) {
            try {
              let text = new TextDecoder('utf-8', { fatal: false }).decode(response.data)
              const kidMatch = text.match(/default_KID[=">]+\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?/i)
              const kid = kidMatch?.[1]?.toLowerCase() ?? null
              text = text.replace(/<ContentProtection[^>]*edef8ba9[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
              text = text.replace(/<ContentProtection[^>]*9a04f079[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
              text = text.replace(/<(?:\w+:)?pssh[^>]*>[\s\S]*?<\/(?:\w+:)?pssh>/gi, '')
              if (kid && !text.includes('e2719d58-a985-b3c9-781a-b030af78d30e')) {
                // Declare xmlns:cenc inline to avoid undeclared namespace prefix causing
                // DOMParser parsererror (Shaka DASH_INVALID_XML / error 4001).
                const ck = `<ContentProtection xmlns:cenc="urn:mpeg:cenc:2013" schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${kid}</cenc:default_KID></ContentProtection>`
                text = text.includes('<ContentProtection')
                  ? text.replace(/<ContentProtection/g, `${ck}\n        <ContentProtection`)
                  : text.replace(/<Representation/g, `${ck}\n        <Representation`)
              }
              response.data = new TextEncoder().encode(text).buffer
            } catch (e) { console.error('[CK manifest filter]', e) }

          } else if (type === ST) {
            // Quick scan for 'pssh' bytes (0x70 0x73 0x73 0x68) before doing full parse
            const raw = new Uint8Array(response.data instanceof ArrayBuffer
              ? response.data : response.data.buffer)
            const limit = Math.min(raw.length, 65536)
            let hasPssh = false
            for (let j = 0; j < limit - 4; j++) {
              if (raw[j] === 0x70 && raw[j+1] === 0x73 && raw[j+2] === 0x73 && raw[j+3] === 0x68) {
                hasPssh = true; break
              }
            }
            if (hasPssh) response.data = stripWidevinePssh(response.data)
          }
        })
      }

      player.addEventListener('adaptation', () => {
        const active = player.getVariantTracks().find((t) => t.active)
        if (active?.height) update({ actualHeight: active.height })
      })

      player.addEventListener('error', (e) => {
        const err = e.detail
        console.warn('Shaka error (severity', err?.severity, 'code', err?.code, ')', err)
        const isCritical = err?.severity === 2
        if (!isCritical) return
        // Network-category errors (1xxx) on a live stream usually mean the
        // embedded CDN token expired — refetch fresh channel data and retry.
        if (err?.category === 1 && tryTokenRecovery(`Shaka network error ${err.code}`)) return
        if (channel.fallbackUrl && !fallbackTriedRef.current) {
          fallbackTriedRef.current = true
          update({ error: null, loading: true })
          player.load(channel.fallbackUrl).catch(() => update({ error: 'Stream failed.', loading: false }))
          return
        }
        const msg =
          err.code === 6007  ? 'DRM licence request failed. Key may be wrong.' :
          err.code === 6001  ? 'DRM init failed — ClearKey config issue.' :
          err.code === 6002  ? 'DRM licence request failed.' :
          err.code === 6003  ? 'DRM licence rejected — key mismatch.' :
          err.code === 1001  ? 'Network error — CDN unreachable.' :
          err.code === 1002  ? 'Network timeout — check your connection.' :
          err.code === 3016  ? 'Stream expired — update the token in channels.js.' :
          err.code === 3032  ? 'Stream quality restricted — try refreshing.' :
                               `Stream error (${err.code}).`
        update({ error: msg, loading: false })
      })

      // Once manifest + segments are flowing, populate quality levels
      player.addEventListener('streaming', () => {
        const tracks = player.getVariantTracks()
        const seen = new Set()
        const shakaLevels = []
        tracks
          .filter((t) => t.height)
          .sort((a, b) => a.height - b.height || (a.frameRate || 0) - (b.frameRate || 0))
          .forEach((t) => {
            const fps = t.frameRate ? Math.round(t.frameRate) : null
            const key = `${t.height}_${fps ?? ''}`
            if (seen.has(key)) return
            seen.add(key)
            const label = `${t.height}p${t.height === 1080 && fps ? ` ${fps}fps` : ''}`
            shakaLevels.push({ id: shakaLevels.length, label, height: t.height, fps })
          })
        const levels = [{ id: -1, label: 'Auto' }, ...shakaLevels]

        // Populate audio tracks from available languages
        const audioLangs = player.getAudioLanguagesAndRoles?.() ?? []
        const seenLangs = new Set()
        const audioTracks = audioLangs
          .filter(({ language }) => { if (seenLangs.has(language)) return false; seenLangs.add(language); return true })
          .map(({ language, role }) => ({ id: language, label: formatLangLabel(language), role }))
        const activeAudio = player.getAudioLanguage?.() ?? null

        // Only apply mid-tier start when Auto is selected — specific quality preferences
        // are applied by the preferredQuality effect and must not be overridden here.
        if (preferredQuality === 'Auto') {
          const allTracks = player.getVariantTracks()
          const sorted = [...allTracks].sort((a, b) => (a.bandwidth ?? 0) - (b.bandwidth ?? 0))
          const midIdx  = Math.floor(sorted.length / 2)
          const starter = sorted[midIdx] ?? sorted[0]
          if (starter) {
            player.configure({ abr: { enabled: false } })
            player.selectVariantTrack(starter, true)
            update({ actualHeight: starter.height ?? 0 })
            setTimeout(() => {
              if (!shakaRef.current) return
              // Re-enable ABR with a resolution cap, but only if the cap doesn't eliminate
              // ALL available tracks (that would throw RESTRICTIONS_CANNOT_BE_SATISFIED).
              const liveTracks = shakaRef.current.getVariantTracks()
              const minH = liveTracks.filter(t => t.height).reduce((m, t) => Math.min(m, t.height), Infinity)
              const safeMax = isFinite(minH) ? Math.max(dashMaxHeight, minH) : dashMaxHeight
              shakaRef.current.configure({ abr: { enabled: true }, restrictions: { maxHeight: safeMax } })
            }, 5000)
          }
        }

        // Stream is live — clear any stale error overlay immediately
        update({ qualityLevels: levels, loading: false, isLive: player.isLive(), error: null, audioTracks, audioTrack: activeAudio })

        const tryPlay = () => {
          video.play().catch((err) => {
            if (isCancelled) return
            if (err.name === 'AbortError') {
              video.addEventListener('canplay', () => { if (!isCancelled) video.play().catch(() => {}) }, { once: true })
            } else if (err.name === 'NotAllowedError') {
              // iOS blocks unmuted autoplay — start muted so video plays, user can unmute via controls
              video.muted = true
              update({ muted: true })
              video.play().catch(() => {})
            }
          })
        }

        // Jump to live edge
        if (player.isLive()) {
          setTimeout(() => {
            const range = player.seekRange()
            if (range.end > 0) video.currentTime = range.end
            tryPlay()
          }, 500)
        } else {
          tryPlay()
        }
      })

      ;(async () => {
        try {
          await player.attach(video)
          await player.load(channel.url, null, channel.mimeType || undefined)
        } catch (err) {
          if (isCancelled) return
          console.error('Shaka load failed', err)
          if (liveRef.current.playing || (liveRef.current.currentTime ?? 0) > 0) return
          if (err?.category === 1 && tryTokenRecovery(`Shaka load network error ${err.code}`)) return
          if (channel.fallbackUrl && !fallbackTriedRef.current) {
            fallbackTriedRef.current = true
            try { await player.load(channel.fallbackUrl, null, channel.mimeType || undefined); return } catch {}
          }
          if (isCancelled) return
          const msg =
            err.code === 6007  ? 'DRM key mismatch — check clearKey in channels.js.' :
            err.code === 6001  ? 'DRM init failed — ClearKey config issue.' :
            err.code === 6002  ? 'DRM licence request failed.' :
            err.code === 6003  ? 'DRM licence rejected — key mismatch.' :
            err.code === 4001  ? 'Stream failed — invalid manifest format.' :
            err.code === 1001  ? 'Network error — CDN unreachable.' :
            err.code === 3016  ? 'Segment fetch failed — token may be expired.' :
            err.code === 3032  ? 'Stream quality restricted — try refreshing.' :
                                 `Stream failed (${err.code ?? err.message}).`
          update({ error: msg, loading: false })
        }
      })()

      return () => {
        isCancelled = true
        if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null }
      }
    }

    // ── HLS via hls.js ──
    // For Sony LIV: always use hls.js + /sl-cdn proxy (Akamai blocks cloud IPs).
    // For other HLS: on Safari, use native playback to avoid CORS issues.
    const canNativeSafariHLS = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    const useSafariNative = isHLS && channel.originalUrl && canNativeSafariHLS && !channel.sonyLivUrl
    if (isHLS && Hls.isSupported() && !useSafariNative) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      const downlink = conn?.downlink ?? 10  // Mbps; assume fast if API unavailable
      const isFast = downlink >= 4 || conn?.effectiveType === '4g'
      // Quality ceiling: a stream whose bitrate exceeds the connection can never fill
      // the buffer, so it stalls forever. Cap the resolution to what the link can sustain.
      const maxHeightCap = downlink >= 8 ? 1080 : downlink >= 3 ? 720 : 480

      const hls = new Hls({
        enableWorker:            true,
        lowLatencyMode:          false,
        // Larger buffers give playback enough cushion to ride out network dips
        // instead of stalling every few seconds (the "play / load / play / load" loop).
        backBufferLength:        60,
        maxBufferLength:         isFast ? 60 : 40,            // seconds of forward buffer to hold
        maxMaxBufferLength:      isFast ? 120 : 90,
        maxBufferSize:           120 * 1000 * 1000,          // 120 MB cap before size-based eviction
        // Wait until a healthy cushion exists before resuming after a stall, so we
        // don't immediately re-stall on the next hiccup.
        maxBufferHole:           0.5,
        highBufferWatchdogPeriod: 3,
        nudgeMaxRetry:           10,
        abrEwmaDefaultEstimate:  2_500_000,                   // conservative start; ABR ramps up as bandwidth proves out
        abrBandWidthFactor:      0.7,                         // stay well below measured peak to avoid stalls
        abrBandWidthUpFactor:    0.6,                         // switch up cautiously
        abrEwmaFastLive:         3.0,                         // smooth bandwidth estimate on live so ABR doesn't thrash
        abrEwmaSlowLive:         9.0,
        capLevelToPlayerSize:    true,                        // never fetch quality larger than the player can show
        capLevelOnFPSDrop:       true,
        fragLoadingMaxRetry:     8,
        fragLoadingRetryDelay:   500,
        fragLoadingMaxRetryTimeout: 8000,
        manifestLoadingMaxRetry: 4,
      })
      hlsRef.current = hls
      hls.loadSource(channel.url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        // Deduplicate by height+fps, keeping the highest-bitrate entry per resolution tier
        const bestByKey = {}
        data.levels.forEach((l, i) => {
          const fps = l.attrs?.['FRAME-RATE'] ? Math.round(parseFloat(l.attrs['FRAME-RATE'])) : null
          const key = `${l.height ?? i}_${fps ?? ''}`
          if (!bestByKey[key] || (l.bitrate ?? 0) > (bestByKey[key].bitrate ?? 0)) {
            const label = l.height ? `${l.height}p${l.height === 1080 && fps ? ` ${fps}fps` : ''}` : `Level ${i + 1}`
            bestByKey[key] = { id: i, label, height: l.height, fps, bitrate: l.bitrate }
          }
        })
        const levels = Object.values(bestByKey).sort((a, b) => (a.height ?? 0) - (b.height ?? 0))

        // Cap ABR to the resolution the connection can sustain so it never climbs
        // to a bitrate that drains the buffer faster than it fills.
        if (preferredQuality === 'Auto') {
          const allowed = data.levels
            .map((l, i) => ({ i, h: l.height ?? 0 }))
            .filter((l) => l.h <= maxHeightCap)
          const capIdx = allowed.length ? Math.max(...allowed.map((l) => l.i)) : -1
          hls.autoLevelCapping = capIdx
          // Start low so the buffer fills fast, then let ABR ramp up within the cap.
          const lowIdx = allowed.length
            ? allowed.reduce((a, b) => (b.h < a.h ? b : a)).i
            : 0
          hls.startLevel = lowIdx
        }

        update({ qualityLevels: [{ id: -1, label: 'Auto' }, ...levels], loading: false })
        video.play().catch((err) => {
          if (isCancelled) return
          if (err.name === 'AbortError') {
            video.addEventListener('canplay', () => { if (!isCancelled) video.play().catch(() => {}) }, { once: true })
          } else if (err.name === 'NotAllowedError') {
            video.muted = true
            update({ muted: true })
            video.play().catch(() => {})
          }
        })
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, { audioTracks: tracks }) => {
        const mapped = (tracks || []).map((t) => ({
          id: String(t.id),
          label: t.name || formatLangLabel(t.lang) || `Audio ${t.id + 1}`,
        }))
        const currentId = hls.audioTrack >= 0 ? String(hls.audioTrack) : (mapped[0]?.id ?? null)
        update({ audioTracks: mapped, audioTrack: currentId })
      })
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, { id }) => update({ audioTrack: String(id) }))
      hls.on(Hls.Events.LEVEL_LOADED, (_, d) => update({ isLive: !!d.details?.live }))
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
        const stored = liveRef.current.qualityLevels.find((l) => l.id === level)
        const actualHeight = data.levels?.[level]?.height ?? stored?.height ?? 0
        update({ quality: stored?.label ?? 'Auto', actualHeight })
      })
      hls.on(Hls.Events.ERROR, (_, d) => {
        // Sony LIV on prod: Akamai returns HTTP 403 for cloud IPs.
        // On mobile (real carrier IP), Akamai does NOT block — retry with originalUrl directly.
        if (channel.sonyLivUrl && d.response?.code === 403 && !fallbackTriedRef.current && channel.originalUrl) {
          fallbackTriedRef.current = true
          update({ error: null, loading: true })
          hls.stopLoad()
          hls.loadSource(channel.originalUrl)
          hls.startLoad()
          return
        }
        if (channel.sonyLivUrl && d.response?.code === 403) {
          update({ error: 'Stream unavailable via proxy.', loading: false })
          hls.stopLoad()
          return
        }
        if (d.fatal) {
          if (channel.fallbackUrl && !fallbackTriedRef.current) {
            fallbackTriedRef.current = true
            update({ error: null, loading: true })
            hls.stopLoad()
            hls.loadSource(channel.fallbackUrl)
            hls.startLoad()
          } else if (channel.sonyLivUrl) {
            update({ error: 'Stream unavailable via proxy.', loading: false })
          } else {
            update({ error: 'Stream failed. Try another channel.', loading: false })
          }
        }
      })
      // Safety net: if nothing happens after 15 s (no manifest, no error, no play)
      // the proxy is likely hanging. Show an actionable error instead of spinning forever.
      const stuckTimer = setTimeout(() => {
        if (isCancelled || liveRef.current.playing || liveRef.current.error) return
        // Proxy stalled (no 403 but no data either) — try originalUrl directly on mobile
        if (channel.sonyLivUrl && !fallbackTriedRef.current && channel.originalUrl) {
          fallbackTriedRef.current = true
          update({ error: null, loading: true })
          if (hlsRef.current) {
            hlsRef.current.stopLoad()
            hlsRef.current.loadSource(channel.originalUrl)
            hlsRef.current.startLoad()
          }
          return
        }
        if (channel.sonyLivUrl) {
          update({ error: 'Stream unavailable via proxy.', loading: false })
        } else {
          update({ error: 'Stream failed to load. Try refreshing.', loading: false })
        }
        if (hlsRef.current) hlsRef.current.stopLoad()
      }, 15000)

      return () => {
        isCancelled = true
        clearTimeout(stuckTimer)
        clearTimeout(hlsRetryTimer)
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      }
    }

    // ── Native fallback (Safari HLS) ──
    // Use the original Akamai URL for Sony LIV on Safari — native <video>
    // doesn't enforce CORS, so it plays directly from Akamai without proxy.
    video.src = channel.originalUrl || channel.url
    video.play().catch(() => {})
    update({ loading: false })
  }, [channel?.url, channel?.clearKey?.keyId, shakaReady])

  // ── Video element events ───────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const on  = (e, fn) => v.addEventListener(e, fn)
    const off = (e, fn) => v.removeEventListener(e, fn)

    const onTime     = () => update({ currentTime: v.currentTime, duration: v.duration || 0 })
    const onProgress = () => { if (v.buffered.length) update({ buffered: v.buffered.end(v.buffered.length - 1) }) }
    // Debounce the spinner: only show it if the stall lasts past ~700ms, so brief
    // micro-stalls don't flash "Loading…" and make playback feel choppier than it is.
    const onWaiting  = () => {
      clearTimeout(waitingTimer.current)
      waitingTimer.current = setTimeout(() => update({ loading: true }), 700)
    }
    const clearWaiting = () => { clearTimeout(waitingTimer.current); waitingTimer.current = null }
    const onPlaying  = () => { clearWaiting(); recoverAttempts.current = 0; update({ loading: false, playing: true, error: null }) }
    const onPause    = () => update({ playing: false })
    const onVolume   = () => update({ volume: v.volume, muted: v.muted })
    const onEnded    = () => update({ playing: false })
    const onLoaded   = () => { clearWaiting(); update({ loading: false }) }
    const onCanPlay  = () => { clearWaiting(); update({ loading: false }) }

    on('timeupdate', onTime); on('progress', onProgress); on('waiting', onWaiting)
    on('playing', onPlaying); on('pause', onPause); on('volumechange', onVolume)
    on('ended', onEnded); on('loadeddata', onLoaded); on('canplay', onCanPlay)

    return () => {
      clearTimeout(waitingTimer.current)
      off('timeupdate', onTime); off('progress', onProgress); off('waiting', onWaiting)
      off('playing', onPlaying); off('pause', onPause); off('volumechange', onVolume)
      off('ended', onEnded); off('loadeddata', onLoaded); off('canplay', onCanPlay)
    }
  }, [])

  // ── Fullscreen / PiP events ────────────────────────────────────────────
  useEffect(() => {
    const onFS = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      )
      update({ fullscreen: isFS })
      if (!isFS) try { screen.orientation?.unlock() } catch {}
    }
    document.addEventListener('fullscreenchange',       onFS)
    document.addEventListener('webkitfullscreenchange', onFS)
    document.addEventListener('mozfullscreenchange',    onFS)
    document.addEventListener('MSFullscreenChange',     onFS)

    // iOS Safari fires these on the video element, not the document
    const vid = videoRef.current
    const onIosEnter = () => update({ fullscreen: true })
    const onIosExit  = () => update({ fullscreen: false })
    vid?.addEventListener('webkitbeginfullscreen', onIosEnter)
    vid?.addEventListener('webkitendfullscreen',   onIosExit)

    return () => {
      document.removeEventListener('fullscreenchange',       onFS)
      document.removeEventListener('webkitfullscreenchange', onFS)
      document.removeEventListener('mozfullscreenchange',    onFS)
      document.removeEventListener('MSFullscreenChange',     onFS)
      vid?.removeEventListener('webkitbeginfullscreen', onIosEnter)
      vid?.removeEventListener('webkitendfullscreen',   onIosExit)
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnter = () => update({ pip: true })
    const onLeave = () => update({ pip: false })
    v.addEventListener('enterpictureinpicture', onEnter)
    v.addEventListener('leavepictureinpicture', onLeave)
    return () => { v.removeEventListener('enterpictureinpicture', onEnter); v.removeEventListener('leavepictureinpicture', onLeave) }
  }, [])

  // ── TextTrack detection (CEA-608 from HLS / TTML from DASH) ─────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const detect = () => {
      const tracks = Array.from(video.textTracks).filter(
        // Exclude HLS.js phantom CEA-608 placeholders (empty label + 'und' language)
        (t) => (t.kind === 'subtitles' || t.kind === 'captions') &&
                !(t.label === '' && (!t.language || t.language === 'und'))
      )
      setStreamTracks(tracks.map((t, i) => ({
        index: i,
        label: t.label || (t.language ? `[${t.language}]` : `Track ${i + 1}`),
      })))
    }
    video.textTracks.addEventListener('addtrack',    detect)
    video.textTracks.addEventListener('removetrack', detect)
    detect()
    return () => {
      video.textTracks.removeEventListener('addtrack',    detect)
      video.textTracks.removeEventListener('removetrack', detect)
    }
  }, [])

  // ── Subtitle apply (track or speech) ─────────────────────────────────
  const applySubtitle = useCallback((mode) => {
    // Close the settings menu
    update({ showQualityMenu: false })

    // Tear down previous mode
    clearTimeout(subClearTimer.current)
    const oldR = speechRef.current; speechRef.current = null
    if (oldR) try { oldR.stop() } catch {}
    if (subtitleTrackClean.current) { subtitleTrackClean.current(); subtitleTrackClean.current = null }
    finalTextRef.current = ''

    // Disable all text tracks
    Array.from(videoRef.current?.textTracks || []).forEach((t) => { t.mode = 'disabled' })

    update({ subtitleMode: mode, subtitleText: '', subtitleInterim: '' })

    if (!mode) return

    if (mode.type === 'track') {
      const track = Array.from(videoRef.current?.textTracks || [])[mode.index]
      if (!track) return
      track.mode = 'hidden'
      const onCue = () => {
        const cues = Array.from(track.activeCues || [])
        const el = document.createElement('div')
        const text = cues.map((c) => {
          el.innerHTML = c.text || ''
          return el.textContent || ''
        }).join('\n').trim()
        update({ subtitleText: text })
      }
      track.addEventListener('cuechange', onCue)
      subtitleTrackClean.current = () => {
        track.removeEventListener('cuechange', onCue)
        try { track.mode = 'disabled' } catch {}
      }
      return
    }

    if (mode.type === 'speech') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) {
        update({ subtitleText: 'Speech recognition not supported in this browser.', subtitleMode: null })
        setTimeout(() => update({ subtitleText: '' }), 3000)
        return
      }
      const lang = channel?.language === 'Hindi' ? 'hi-IN' : 'en-US'
      const r = new SR()
      r.continuous     = true
      r.interimResults = true
      r.lang           = lang
      r.maxAlternatives = 1

      r.onresult = (e) => {
        let newFinal = ''; let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) newFinal += e.results[i][0].transcript + ' '
          else interim = e.results[i][0].transcript
        }
        clearTimeout(subClearTimer.current)
        if (newFinal) {
          finalTextRef.current = (finalTextRef.current + newFinal).slice(-400)
          const recent = finalTextRef.current.trim().split(/(?<=[.!?])\s+/).slice(-2).join(' ')
          update({ subtitleText: recent, subtitleInterim: '' })
          // Clear text 4 s after the last spoken word
          subClearTimer.current = setTimeout(() => {
            finalTextRef.current = ''
            update({ subtitleText: '', subtitleInterim: '' })
          }, 4000)
        } else if (interim) {
          update({ subtitleInterim: interim })
          // Extend the clear deadline while speech is in progress
          subClearTimer.current = setTimeout(() => {
            finalTextRef.current = ''
            update({ subtitleText: '', subtitleInterim: '' })
          }, 5000)
        }
      }

      r.onerror = (e) => {
        if (e.error === 'no-speech') return
        if (e.error !== 'aborted') {
          update({ subtitleText: `Mic: ${e.error}`, subtitleInterim: '' })
          setTimeout(() => update({ subtitleText: '' }), 2500)
        }
      }

      r.onend = () => {
        // Auto-restart only if this same instance is still active
        if (speechRef.current === r && liveRef.current.subtitleMode?.type === 'speech') {
          try { r.start() } catch {}
        }
      }

      r.start()
      speechRef.current = r
    }
  }, [channel?.language, update])

  // ── Controls auto-hide ────────────────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    update({ showControls: true })
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (liveRef.current.playing) update({ showControls: false })
    }, 3000)
  }, [])

  // Auto-hide controls once playback begins (critical for mobile — no mousemove events)
  useEffect(() => {
    if (state.playing) showControlsTemporarily()
  }, [state.playing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    clearTimeout(hideTimer.current)
    clearTimeout(seekIndicatorTimer.current)
    clearTimeout(clickTimer.current)
    clearTimeout(swipeHideTimer.current)
    clearTimeout(subClearTimer.current)
  }, [])

  // ── Player actions ────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }, [])

  const seek = useCallback((seconds) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds))
    clearTimeout(seekIndicatorTimer.current)
    update({ seekIndicator: seconds > 0 ? 'forward' : 'backward' })
    seekIndicatorTimer.current = setTimeout(() => update({ seekIndicator: null }), 700)
    showControlsTemporarily()
  }, [showControlsTemporarily])

  const seekTo = useCallback((time) => {
    const v = videoRef.current; if (v) v.currentTime = time
    showControlsTemporarily()
  }, [showControlsTemporarily])

  const changeVolume = useCallback((delta) => {
    const v = videoRef.current; if (!v) return
    v.volume = Math.max(0, Math.min(1, v.volume + delta))
    if (v.muted) v.muted = false
  }, [])

  const setVolume = useCallback((val) => {
    const v = videoRef.current; if (!v) return
    v.volume = val; v.muted = val === 0
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (v) v.muted = !v.muted
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el  = containerRef.current
    const vid = videoRef.current
    if (!el) return

    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    )

    if (isFs) {
      try { screen.orientation?.unlock() } catch {}
      const exit =
        document.exitFullscreen?.bind(document) ||
        document.webkitExitFullscreen?.bind(document) ||
        document.mozCancelFullScreen?.bind(document) ||
        document.msExitFullscreen?.bind(document)
      await exit?.().catch(() => {})
    } else {
      // 1. Standard API
      if (el.requestFullscreen) {
        await el.requestFullscreen().catch(() => {})
      // 2. WebKit (older Android / Samsung browser)
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen().catch(() => {})
      // 3. Mozilla
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen().catch(() => {})
      // 4. iOS Safari — only the <video> element itself supports native fullscreen
      } else if (vid?.webkitEnterFullscreen) {
        vid.webkitEnterFullscreen()
        return   // iOS manages its own fullscreen state; no orientation lock needed
      }
      try { await screen.orientation?.lock('landscape') } catch {}
    }
  }, [])

  const togglePIP = useCallback(async () => {
    const v = videoRef.current; if (!v) return
    try {
      document.pictureInPictureElement
        ? await document.exitPictureInPicture()
        : document.pictureInPictureEnabled && await v.requestPictureInPicture()
    } catch (_) {}
  }, [])

  const goLive = useCallback(() => {
    const v = videoRef.current; if (!v) return
    // seekable.end is the true live edge reported by the MSE buffer — more accurate
    // than liveSyncPosition (which HLS.js intentionally targets behind the edge)
    // or seekRange().end which can lag by a segment. Subtract 0.1 s so we don't
    // land past the buffered region and trigger an unnecessary re-buffer.
    const edge = v.seekable.length > 0
      ? v.seekable.end(v.seekable.length - 1)
      : (isFinite(v.duration) ? v.duration : null)
    if (edge !== null) v.currentTime = Math.max(0, edge - 0.1)
    v.play()
  }, [])

  // ── Aspect ratio cycle ────────────────────────────────────────────────
  const cycleFit = useCallback(() => {
    const fits = ['contain', 'cover', 'fill']
    const next = fits[(fits.indexOf(liveRef.current.objectFit) + 1) % fits.length]
    update({ objectFit: next, zoom: 1 })
  }, [update])

  // ── Swipe gesture handlers (brightness left / volume right / pinch zoom) ─
  const handleTouchStart = useCallback((e) => {
    if (liveRef.current.locked) return
    clearTimeout(swipeHideTimer.current)
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      gestureRef.current = { ...gestureRef.current, pinchActive: true, pinchDist: Math.hypot(dx, dy), startZoom: liveRef.current.zoom, active: false }
      return
    }
    if (e.touches.length === 1) {
      // Don't hijack swipes that belong to a scrollable overlay (settings sheet, hints)
      if (e.target?.closest?.('[data-no-gesture]')) return
      if (!liveRef.current.fullscreen) return  // brightness/volume swipe only in fullscreen
      const t = e.touches[0]
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const side = (t.clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
      gestureRef.current = { active: true, isSwipe: false, side, startY: t.clientY, startValue: side === 'left' ? liveRef.current.brightness : liveRef.current.volume, pinchActive: false, pinchDist: 0, startZoom: liveRef.current.zoom }
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (liveRef.current.locked) return
    // Pinch zoom
    if (gestureRef.current.pinchActive && e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const newZoom = Math.max(1, Math.min(3, gestureRef.current.startZoom * (Math.hypot(dx, dy) / gestureRef.current.pinchDist)))
      update({ zoom: newZoom })
      return
    }
    if (!gestureRef.current.active || e.touches.length !== 1) return
    const deltaY = gestureRef.current.startY - e.touches[0].clientY
    if (!gestureRef.current.isSwipe) {
      if (Math.abs(deltaY) < 12) return
      gestureRef.current.isSwipe = true
    }
    e.preventDefault()
    clearTimeout(swipeHideTimer.current)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    if (gestureRef.current.side === 'left') {
      const brightness = Math.max(0.1, Math.min(2, gestureRef.current.startValue + (deltaY / rect.height) * 2))
      update({ brightness, swipeIndicator: { type: 'brightness', barValue: (brightness - 0.1) / 1.9, displayValue: Math.round(brightness * 100), side: 'left' } })
    } else {
      const volume = Math.max(0, Math.min(1, gestureRef.current.startValue + deltaY / rect.height))
      if (videoRef.current) { videoRef.current.volume = volume; videoRef.current.muted = volume === 0 }
      update({ volume, swipeIndicator: { type: 'volume', barValue: volume, displayValue: Math.round(volume * 100), side: 'right' } })
    }
  }, [update])

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.active = false
    gestureRef.current.pinchActive = false
    clearTimeout(swipeHideTimer.current)
    swipeHideTimer.current = setTimeout(() => update({ swipeIndicator: null }), 1200)
  }, [update])

  // Register non-passive listeners so preventDefault actually stops page scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove',  handleTouchMove,  { passive: false })
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove',  handleTouchMove)
      el.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const setQuality = useCallback((levelId) => {
    if (shakaRef.current) {
      if (levelId === -1) {
        shakaRef.current.configure({ abr: { enabled: true } })
        update({ quality: 'Auto', showQualityMenu: false })
      } else {
        const levels = liveRef.current.qualityLevels
        const level  = levels.find((l) => l.id === levelId)
        if (level?.height) {
          const restrictions = { maxHeight: level.height, minHeight: level.height }
          if (level.fps) { restrictions.maxFrameRate = level.fps; restrictions.minFrameRate = level.fps }
          shakaRef.current.configure({ abr: { enabled: false }, restrictions })
          update({ quality: level.label, showQualityMenu: false })
        }
      }
    } else if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId
      const stored = liveRef.current.qualityLevels.find((l) => l.id === levelId)
      update({ quality: levelId === -1 ? 'Auto' : stored?.label ?? 'Auto', showQualityMenu: false })
    }
  }, [])

  // Apply the global quality preference the first time levels are available for a stream
  useEffect(() => {
    if (!state.qualityLevels.length || preferredQualityApplied.current) return
    preferredQualityApplied.current = true
    if (preferredQuality === 'Auto') return
    const match = state.qualityLevels.find((l) => l.label === preferredQuality)
    if (match) setQuality(match.id)
  }, [state.qualityLevels, preferredQuality, setQuality])

  const setAudioTrack = useCallback((id) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = parseInt(id, 10)
    } else if (shakaRef.current) {
      shakaRef.current.selectAudioLanguage(id)
      update({ audioTrack: id })
    }
    update({ showQualityMenu: false })
  }, [update])

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); showControlsTemporarily(); break
        case 'ArrowRight': e.preventDefault(); seek(10); break
        case 'ArrowLeft':  e.preventDefault(); seek(-10); break
        case 'ArrowUp':    e.preventDefault(); changeVolume(0.1); showControlsTemporarily(); break
        case 'ArrowDown':  e.preventDefault(); changeVolume(-0.1); showControlsTemporarily(); break
        case 'm': case 'M': toggleMute(); showControlsTemporarily(); break
        case 'f': case 'F': toggleFullscreen(); break
        case 'p': case 'P': togglePIP(); break
        case 'l': case 'L': goLive(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seek, changeVolume, toggleMute, toggleFullscreen, togglePIP, goLive, showControlsTemporarily])

  // ── Single vs double tap/click disambiguation ─────────────────────────
  const lastTapX = useRef(null)
  const handleCenterClick = useCallback((e) => {
    e.stopPropagation()
    const clientX = e.clientX ?? e.touches?.[0]?.clientX
    if (clickTimer.current) {
      clearTimeout(clickTimer.current); clickTimer.current = null
      // Double tap: seek based on which half was tapped
      const rect = containerRef.current?.getBoundingClientRect()
      const x = lastTapX.current ?? clientX
      if (rect && x !== undefined) {
        const isRight = (x - rect.left) >= rect.width / 2
        seek(isRight ? 10 : -10)
      }
    } else {
      lastTapX.current = clientX
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        // Single tap: toggle controls visibility
        if (liveRef.current.showControls) {
          clearTimeout(hideTimer.current)
          update({ showControls: false })
        } else {
          showControlsTemporarily()
        }
      }, 220)
    }
  }, [seek, showControlsTemporarily, update])

  const qualityLevels = state.qualityLevels.length
    ? state.qualityLevels
    : (channel?.quality || ['Auto', '1080p', '720p', '480p']).map((q, i) => ({ id: i - 1, label: q }))

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none ${state.fullscreen ? 'h-screen' : ''} ${state.playing && !state.showControls ? 'cursor-none' : ''}`}
      style={{ aspectRatio: state.fullscreen ? undefined : '16/9' }}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => update({ showControls: true })}
      onMouseLeave={() => { if (liveRef.current.playing) update({ showControls: false }) }}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        style={{
          objectFit: state.objectFit,
          transform: `scale(${state.zoom}) translateZ(0)`,  // force GPU compositing layer
          filter: `brightness(${state.brightness})${state.enhance ? ' contrast(1.1) saturate(1.15)' : ''}`,
          transformOrigin: 'center',
          willChange: 'transform',      // hint browser to promote to compositor thread
        }}
        playsInline preload="auto" x-webkit-airplay="allow"
      />

      {/* Loading spinner */}
      <AnimatePresence>
        {state.loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-brand-500/30 rounded-full" />
              <div className="absolute inset-0 border-4 border-transparent border-t-brand-500 rounded-full animate-spin" />
            </div>
            <p className="absolute mt-24 text-white/50 text-sm font-medium">Loading stream…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {state.error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-3 px-6">
              <div className="text-5xl">📡</div>
              <p className="text-white font-semibold text-base">{state.error}</p>
              {channel?.sonyLivUrl ? (
                <div className="space-y-2">
                  <a
                    href={channel.sonyLivUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#0057FF] hover:bg-[#0046cc] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                    Watch on Sony LIV
                  </a>
                </div>
              ) : (
                <p className="text-white/40 text-sm">Stream tokens expire after ~6 hours.<br />Update the URL in channels.js with a fresh token.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Casting overlay */}
      <AnimatePresence>
        {(casting || castPhase === 'connecting') && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 pointer-events-none z-10"
          >
            <svg className={`w-16 h-16 text-brand-500 mb-4 ${castPhase === 'connecting' ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
              <line x1="2" y1="20" x2="2.01" y2="20"/>
            </svg>
            <p className="text-white font-semibold text-sm">
              {castPhase === 'connecting' ? 'Connecting to TV…' : 'Casting to TV'}
            </p>
            <p className="text-white/50 text-xs mt-1">{channel?.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No-device / VPN hint */}
      <AnimatePresence>
        {castHint && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6"
            onClick={() => setCastHint(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-xs w-full bg-dark-800 border border-white/10 rounded-2xl p-5 text-center"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <WifiOff size={22} className="text-yellow-400" />
              </div>
              <h3 className="text-white font-bold text-base mb-2">No TV found</h3>
              <p className="text-white/55 text-sm leading-relaxed mb-4">
                If your <span className="text-white/80 font-semibold">VPN is on</span>, it's blocking your phone from seeing the TV. Open your VPN app and enable
                {' '}<span className="text-white/80 font-semibold">“Allow local network / LAN”</span>, then tap Cast again.
              </p>
              <button
                onClick={() => setCastHint(false)}
                className="w-full py-2.5 rounded-xl bg-brand-500 text-black font-bold text-sm active:scale-95 transition-transform"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seek indicator */}
      <SeekIndicator type={state.seekIndicator} />

      {/* ── Swipe indicator (brightness / volume) ── */}
      <AnimatePresence>
        {state.swipeIndicator && (
          <motion.div
            key={state.swipeIndicator.type}
            initial={{ opacity: 0, x: state.swipeIndicator.side === 'left' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 bg-black/65 backdrop-blur-md rounded-2xl px-3 py-4 pointer-events-none ${
              state.swipeIndicator.side === 'left' ? 'left-4' : 'right-4'
            }`}
          >
            {state.swipeIndicator.type === 'brightness'
              ? <Sun size={18} className="text-yellow-400" />
              : <VolumeSwipeIcon size={18} className="text-white" />
            }
            {/* Vertical bar */}
            <div className="w-1.5 h-24 bg-white/20 rounded-full overflow-hidden relative">
              <motion.div
                className={`absolute bottom-0 left-0 right-0 rounded-full ${
                  state.swipeIndicator.type === 'brightness' ? 'bg-yellow-400' : 'bg-white'
                }`}
                animate={{ height: `${Math.round(state.swipeIndicator.barValue * 100)}%` }}
                transition={{ duration: 0.06 }}
              />
            </div>
            <span className="text-white text-[11px] font-bold tabular-nums">
              {state.swipeIndicator.displayValue}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Subtitle overlay ── */}
      <SubtitleOverlay
        text={state.subtitleText}
        interim={state.subtitleInterim}
        controlsVisible={!state.locked && (state.showControls || !state.playing)}
      />

      {/* ── Locked overlay ── */}
      <AnimatePresence>
        {state.locked && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20"
            onClick={showControlsTemporarily}
          >
            {/* Permanent lock badge — top right */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Lock size={14} className="text-white/70" />
            </div>

            {/* Tap-to-unlock button — appears briefly on tap */}
            <AnimatePresence>
              {state.showControls && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.18 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => { e.stopPropagation(); update({ locked: false }) }}
                    className="flex flex-col items-center gap-2 bg-black/65 backdrop-blur-sm rounded-2xl px-7 py-5 border border-white/20 pointer-events-auto"
                  >
                    <LockOpen size={26} className="text-white" />
                    <span className="text-white text-xs font-semibold tracking-wide">Tap to unlock</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls overlay (hidden while locked) ── */}
      <AnimatePresence>
        {!state.locked && (state.showControls || !state.playing) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex flex-col justify-between"
            style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 40%,rgba(0,0,0,0.35) 100%)' }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Back button — mobile only, auto-hides with controls */}
                {onBack && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onBack() }}
                    className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white/90 flex-shrink-0 active:scale-90 transition-transform"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                {channel?.isLive && (
                  <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                )}
                <span className="text-white font-semibold text-sm drop-shadow truncate">{channel?.currentMatch}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {state.pip && <span className="text-[10px] bg-brand-500/80 text-white px-2 py-0.5 rounded">PiP</span>}
                <div className="flex items-center gap-1.5 glass px-2 py-1 rounded">
                  <QualityWifi quality={state.quality} actualHeight={state.actualHeight} />
                  <span className="text-white text-xs font-semibold">{state.quality}</span>
                </div>
                {channel?.url?.includes('.mpd') && (
                  <span className="text-[10px] bg-purple-700/70 text-white px-2 py-0.5 rounded font-bold">DASH</span>
                )}
              </div>
            </div>

            {/* Center click zone — single tap: toggle controls | double tap: seek ±10s */}
            <div className="absolute inset-0 cursor-pointer" onClick={handleCenterClick}>
              <AnimatePresence>
                {!state.playing && !state.loading && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearTimeout(clickTimer.current)
                      clickTimer.current = null
                      togglePlay()
                      showControlsTemporarily()
                    }}
                  >
                    <div className="w-20 h-20 bg-black/55 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                      <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <PlayerControls
              state={state}
              channel={channel}
              onPlayPause={togglePlay}
              onSeek={seek}
              onSeekTo={seekTo}
              onVolume={setVolume}
              onMute={toggleMute}
              onFullscreen={toggleFullscreen}
              onGoLive={goLive}
              onToggleQuality={() => update({ showQualityMenu: !state.showQualityMenu })}
              onLock={() => update({ locked: true, showControls: false })}
              subtitleActive={state.subtitleMode !== null}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings menu (quality + subtitles) */}
      <AnimatePresence>
        {state.showQualityMenu && (
          <SettingsMenu
            levels={qualityLevels}
            currentQuality={state.quality}
            onSelectQuality={setQuality}
            audioTracks={state.audioTracks}
            audioTrack={state.audioTrack}
            onSelectAudio={setAudioTrack}
            streamTracks={streamTracks}
            subtitleMode={state.subtitleMode}
            onSelectSubtitle={applySubtitle}
            enhance={state.enhance}
            onToggleEnhance={() => update({ enhance: !state.enhance })}
            pipEnabled={typeof document !== 'undefined' && document.pictureInPictureEnabled}
            pip={state.pip}
            onPIP={togglePIP}
            objectFit={state.objectFit}
            onFitChange={cycleFit}
            airPlayAvailable={airPlayAvailable}
            onAirPlay={toggleAirPlay}
            castAvailable={castAvailable}
            casting={casting}
            castPhase={castPhase}
            devicesPresent={devicesPresent}
            onCast={toggleCast}
            onClose={() => update({ showQualityMenu: false })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
