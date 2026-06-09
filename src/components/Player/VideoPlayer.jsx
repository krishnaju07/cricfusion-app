import { useRef, useState, useEffect, useCallback } from 'react'
import Hls from 'hls.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LockOpen, Sun, Volume2 as VolumeSwipeIcon } from 'lucide-react'
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

export default function VideoPlayer({ channel }) {
  const videoRef    = useRef(null)
  const hlsRef      = useRef(null)
  const shakaRef    = useRef(null)
  const containerRef = useRef(null)
  const hideTimer   = useRef(null)
  const seekIndicatorTimer = useRef(null)
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

  const { preferredQuality } = useStore()

  const [streamTracks, setStreamTracks] = useState([])   // detected text tracks from stream
  const [castAvailable, setCastAvailable]   = useState(false)
  const [casting, setCasting]               = useState(false)
  const [airPlayAvailable, setAirPlayAvailable] = useState(false)

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
      return next
    })
  }, [])

  // ── Chromecast init ───────────────────────────────────────────────────
  useEffect(() => {
    const init = () => {
      try {
        const { cast, chrome } = window
        cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        })
        cast.framework.CastContext.getInstance().addEventListener(
          cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (e) => {
            const active =
              e.sessionState === cast.framework.SessionState.SESSION_STARTED ||
              e.sessionState === cast.framework.SessionState.SESSION_RESUMED
            setCasting(active)
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

  const startCast = useCallback(async () => {
    if (!channel?.url) return
    try {
      const { cast, chrome } = window
      const ctx = cast.framework.CastContext.getInstance()
      if (ctx.getSessionState() === cast.framework.SessionState.NO_SESSION) {
        await ctx.requestSession()
      }
      const session = ctx.getCurrentSession()
      if (!session) return

      const url = channel.url.startsWith('/')
        ? `${window.location.origin}${channel.url}`
        : channel.url
      const mimeType = url.includes('.mpd') ? 'application/dash+xml' : 'application/x-mpegURL'

      const mediaInfo = new chrome.cast.media.MediaInfo(url, mimeType)
      mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata()
      mediaInfo.metadata.title = channel.name || 'CricFusion'
      mediaInfo.metadata.subtitle = channel.currentMatch || ''
      if (channel.thumbnail) mediaInfo.metadata.images = [new chrome.cast.Image(channel.thumbnail)]

      await session.loadMedia(new chrome.cast.media.LoadRequest(mediaInfo))
    } catch (err) {
      console.warn('[cast]', err)
    }
  }, [channel])

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

    const isMPD = channel.url.includes('.mpd') || channel.url.includes('/api/tp-mpd')
    const isHLS = channel.url.includes('.m3u8')

    // ── DASH / MPD via Shaka Player ──
    if (isMPD) {
      const shaka = window.shaka
      if (!shaka) {
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

      // DRM: ClearKey (inline keys or license server)
      const cfg = {
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 10,
          rebufferingGoal: 2,
          stallEnabled: true,
        },
        abr: { enabled: true },
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
      if (channel.drmSystem === 'clearkey') {
        player.getNetworkingEngine().registerResponseFilter((type, response) => {
          const MT = shaka.net.NetworkingEngine.RequestType.MANIFEST
          const ST = shaka.net.NetworkingEngine.RequestType.SEGMENT

          if (type === MT) {
            try {
              let text = new TextDecoder('utf-8', { fatal: false }).decode(response.data)
              const kidMatch = text.match(/default_KID="\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?"/i)
              const kid = kidMatch?.[1]?.toLowerCase() ?? null
              text = text.replace(/<ContentProtection[^>]*edef8ba9[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
              text = text.replace(/<ContentProtection[^>]*9a04f079[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
              text = text.replace(/<(?:\w+:)?pssh[^>]*>[\s\S]*?<\/(?:\w+:)?pssh>/gi, '')
              if (kid && !text.includes('e2719d58-a985-b3c9-781a-b030af78d30e')) {
                const ck = `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${kid}</cenc:default_KID></ContentProtection>`
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

      player.addEventListener('error', (e) => {
        const err = e.detail
        console.warn('Shaka error (severity', err?.severity, 'code', err?.code, ')', err)
        const isCritical = err?.severity === 2
        if (!isCritical) return
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

        // Stream is live — clear any stale error overlay immediately
        update({ qualityLevels: levels, loading: false, isLive: player.isLive(), error: null, audioTracks, audioTrack: activeAudio })

        const tryPlay = () => {
          video.play().catch((err) => {
            if (err.name === 'AbortError' && !isCancelled) {
              video.addEventListener('canplay', () => { if (!isCancelled) video.play().catch(() => {}) }, { once: true })
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
          await player.load(channel.url)
        } catch (err) {
          if (isCancelled) return
          console.error('Shaka load failed', err)
          if (liveRef.current.playing || (liveRef.current.currentTime ?? 0) > 0) return
          if (channel.fallbackUrl && !fallbackTriedRef.current) {
            fallbackTriedRef.current = true
            try { await player.load(channel.fallbackUrl); return } catch {}
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
    // Skip hls.js for Sony LIV on Safari — Safari's native <video> plays HLS
    // directly from Akamai without CORS, while hls.js XHR is CORS-blocked.
    const canNativeSafariHLS = video.canPlayType('application/vnd.apple.mpegurl') !== ''
    const useSafariNative = isHLS && channel.originalUrl && canNativeSafariHLS
    if (isHLS && Hls.isSupported() && !useSafariNative) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // Sony LIV: Akamai always 403s from cloud IPs — no point retrying
        ...(channel.sonyLivUrl && {
          manifestLoadingMaxRetry: 0,
          levelLoadingMaxRetry: 0,
          fragLoadingMaxRetry: 0,
          manifestLoadingTimeOut: 8000,
        }),
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
        update({ qualityLevels: [{ id: -1, label: 'Auto' }, ...levels], loading: false })
        video.play().catch((err) => {
          // MediaSource not ready yet — wait for canplay then retry
          if (err.name === 'AbortError' && !isCancelled) {
            video.addEventListener('canplay', () => { if (!isCancelled) video.play().catch(() => {}) }, { once: true })
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
        update({ quality: stored?.label ?? 'Auto' })
      })
      hls.on(Hls.Events.ERROR, (_, d) => {
        // Sony LIV: ANY error = Akamai blocked the cloud proxy — show link right away
        if (channel.sonyLivUrl) {
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
          } else {
            update({ error: 'Stream error. Retrying…', loading: false })
            hlsRetryTimer = setTimeout(() => {
              if (!isCancelled && hlsRef.current) { hlsRef.current.startLoad(); update({ error: null, loading: true }) }
            }, 3000)
          }
        }
      })
      return () => {
        isCancelled = true
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
  }, [channel?.url, channel?.clearKey?.keyId])

  // ── Video element events ───────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const on  = (e, fn) => v.addEventListener(e, fn)
    const off = (e, fn) => v.removeEventListener(e, fn)

    const onTime     = () => update({ currentTime: v.currentTime, duration: v.duration || 0 })
    const onProgress = () => { if (v.buffered.length) update({ buffered: v.buffered.end(v.buffered.length - 1) }) }
    const onWaiting  = () => update({ loading: true })
    const onPlaying  = () => update({ loading: false, playing: true, error: null })
    const onPause    = () => update({ playing: false })
    const onVolume   = () => update({ volume: v.volume, muted: v.muted })
    const onEnded    = () => update({ playing: false })
    const onLoaded   = () => update({ loading: false })

    on('timeupdate', onTime); on('progress', onProgress); on('waiting', onWaiting)
    on('playing', onPlaying); on('pause', onPause); on('volumechange', onVolume)
    on('ended', onEnded); on('loadeddata', onLoaded)

    return () => {
      off('timeupdate', onTime); off('progress', onProgress); off('waiting', onWaiting)
      off('playing', onPlaying); off('pause', onPause); off('volumechange', onVolume)
      off('ended', onEnded); off('loadeddata', onLoaded)
    }
  }, [])

  // ── Fullscreen / PiP events ────────────────────────────────────────────
  useEffect(() => {
    const onFS = () => {
      const isFS = !!document.fullscreenElement
      update({ fullscreen: isFS })
      // Unlock orientation whenever fullscreen exits (Escape key, browser back, etc.)
      if (!isFS) try { screen.orientation?.unlock() } catch {}
    }
    document.addEventListener('fullscreenchange', onFS)
    return () => document.removeEventListener('fullscreenchange', onFS)
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
    const el = containerRef.current; if (!el) return
    if (document.fullscreenElement) {
      try { screen.orientation?.unlock() } catch {}
      await document.exitFullscreen().catch(() => {})
    } else {
      await el.requestFullscreen().catch(() => {})
      // Lock to landscape after fullscreen is established — works on Android Chrome.
      // iOS Safari ignores this silently (it handles rotation natively).
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

  // ── Single vs double click disambiguation ─────────────────────────────
  const handleCenterClick = useCallback((e) => {
    e.stopPropagation()
    if (clickTimer.current) {
      clearTimeout(clickTimer.current); clickTimer.current = null
      toggleFullscreen()
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        togglePlay(); showControlsTemporarily()
      }, 220)
    }
  }, [togglePlay, toggleFullscreen, showControlsTemporarily])

  const qualityLevels = state.qualityLevels.length
    ? state.qualityLevels
    : (channel?.quality || ['Auto', '1080p', '720p', '480p']).map((q, i) => ({ id: i - 1, label: q }))

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none ${state.fullscreen ? 'h-screen' : ''}`}
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
          transform: `scale(${state.zoom})`,
          filter: `brightness(${state.brightness})${state.enhance ? ' contrast(1.1) saturate(1.15)' : ''}`,
          transformOrigin: 'center',
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
                  <p className="text-white/40 text-sm">Stream unavailable via proxy.</p>
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
        {casting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 pointer-events-none z-10"
          >
            <svg className="w-16 h-16 text-brand-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
              <line x1="2" y1="20" x2="2.01" y2="20"/>
            </svg>
            <p className="text-white font-semibold text-sm">Casting to TV</p>
            <p className="text-white/50 text-xs mt-1">{channel?.name}</p>
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
                {channel?.isLive && (
                  <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                )}
                <span className="text-white font-semibold text-sm drop-shadow truncate">{channel?.currentMatch}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {state.pip && <span className="text-[10px] bg-brand-500/80 text-white px-2 py-0.5 rounded">PiP</span>}
                <span className="glass text-white text-xs px-2 py-1 rounded font-semibold">{state.quality}</span>
                {channel?.url?.includes('.mpd') && (
                  <span className="text-[10px] bg-purple-700/70 text-white px-2 py-0.5 rounded font-bold">DASH</span>
                )}
              </div>
            </div>

            {/* Center click zone */}
            <div className="absolute inset-0 cursor-pointer" onClick={handleCenterClick}>
              <AnimatePresence>
                {!state.playing && !state.loading && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
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
              onPIP={togglePIP}
              onGoLive={goLive}
              onToggleQuality={() => update({ showQualityMenu: !state.showQualityMenu })}
              onLock={() => update({ locked: true, showControls: false })}
              subtitleActive={state.subtitleMode !== null}
              objectFit={state.objectFit}
              onFitChange={cycleFit}
              castAvailable={castAvailable}
              casting={casting}
              onCast={toggleCast}
              airPlayAvailable={airPlayAvailable}
              onAirPlay={toggleAirPlay}
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
            onClose={() => update({ showQualityMenu: false })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
