import { useRef, useState, useEffect, useCallback } from 'react'
import Hls from 'hls.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LockOpen } from 'lucide-react'
import PlayerControls from './PlayerControls'
import QualityMenu from './QualityMenu'
import SeekIndicator from './SeekIndicator'

// Extract the __hdnea__ token from a Jio CDN URL to re-append on segment requests
function extractToken(url) {
  const match = url.match(/[?&](__hdnea__=[^&]+)/)
  return match ? match[1] : null
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
    seekIndicator: null,
    isLive: false,
    locked: false,
  })

  const update = useCallback((patch) => {
    setState((s) => {
      const next = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }
      liveRef.current = next
      return next
    })
  }, [])

  // ── Initialise player ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !channel?.url) return

    update({ loading: true, error: null, currentTime: 0, duration: 0, qualityLevels: [], isLive: false, quality: 'Auto' })

    // Tear down any existing player
    if (hlsRef.current)   { hlsRef.current.destroy();  hlsRef.current  = null }
    if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null }
    video.removeAttribute('src')
    video.load()

    const isMPD = channel.url.includes('.mpd')
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

      const player = new shaka.Player(video)
      shakaRef.current = player

      // DRM: ClearKey
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
      }
      player.configure(cfg)

      // Token injection: append __hdnea__ to every segment request
      const token = extractToken(channel.url)
      if (token) {
        player.getNetworkingEngine().registerRequestFilter((type, request) => {
          if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
            request.uris = request.uris.map((u) =>
              u.includes('?') ? `${u}&${token}` : `${u}?${token}`
            )
          }
        })
      }

      player.addEventListener('error', (e) => {
        const err = e.detail
        console.warn('Shaka error (severity', err?.severity, 'code', err?.code, ')', err)
        // Severity 2 = CRITICAL (unrecoverable), 1 = RECOVERABLE (Shaka handles it internally)
        // Only block the player for truly fatal errors — not segment/parse warnings
        const isCritical = err?.severity === 2
        if (!isCritical) return   // recoverable: just log, keep playing
        const msg =
          err.code === 6007  ? 'DRM licence request failed. Key may be wrong.' :
          err.code === 1001  ? 'Network error — CDN unreachable.' :
          err.code === 1002  ? 'Network timeout — check your connection.' :
          err.code === 3016  ? 'Stream expired — update the token in channels.js.' :
                               `Stream error (${err.code}).`
        update({ error: msg, loading: false })
      })

      // Once manifest + segments are flowing, populate quality levels
      player.addEventListener('streaming', () => {
        const tracks = player.getVariantTracks()
        const heights = [...new Set(tracks.map((t) => t.height).filter(Boolean))].sort((a, b) => b - a)
        const levels = [
          { id: -1, label: 'Auto' },
          ...heights.map((h, i) => ({ id: i, label: `${h}p`, height: h })),
        ]
        // Stream is live — clear any stale error overlay immediately
        update({ qualityLevels: levels, loading: false, isLive: player.isLive(), error: null })

        // Jump to live edge
        if (player.isLive()) {
          setTimeout(() => {
            const range = player.seekRange()
            if (range.end > 0) video.currentTime = range.end
            video.play().catch(() => {})
          }, 500)
        } else {
          video.play().catch(() => {})
        }
      })

      ;(async () => {
        try {
          await player.load(channel.url)
        } catch (err) {
          console.error('Shaka load failed', err)
          // If streaming already started (manifest + first segment played), the
          // load() rejection can be a false alarm — don't stomp the playing state.
          if (liveRef.current.playing || (liveRef.current.currentTime ?? 0) > 0) return
          const msg =
            err.code === 6007  ? 'DRM key mismatch — check clearKey in channels.js.' :
            err.code === 1001  ? 'Network error — CDN unreachable.' :
            err.code === 3016  ? 'Segment fetch failed — token may be expired.' :
                                 `Stream failed (${err.code ?? err.message}).`
          update({ error: msg, loading: false })
        }
      })()

      return () => {
        if (shakaRef.current) { shakaRef.current.destroy(); shakaRef.current = null }
      }
    }

    // ── HLS via hls.js ──
    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 })
      hlsRef.current = hls
      hls.loadSource(channel.url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = data.levels.map((l, i) => ({ id: i, label: l.height ? `${l.height}p` : `Level ${i + 1}` }))
        update({ qualityLevels: [{ id: -1, label: 'Auto' }, ...levels], loading: false })
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.LEVEL_LOADED, (_, d) => update({ isLive: !!d.details?.live }))
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
        const lev = hls.levels[level]
        update({ quality: lev?.height ? `${lev.height}p` : 'Auto' })
      })
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (d.fatal) {
          update({ error: 'Stream error. Retrying…', loading: false })
          setTimeout(() => { if (hlsRef.current) { hlsRef.current.startLoad(); update({ error: null, loading: true }) } }, 3000)
        }
      })
      return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
    }

    // ── Native fallback ──
    video.src = channel.url
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

  // ── Controls auto-hide ────────────────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    update({ showControls: true })
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (liveRef.current.playing) update({ showControls: false })
    }, 3000)
  }, [])

  useEffect(() => () => {
    clearTimeout(hideTimer.current)
    clearTimeout(seekIndicatorTimer.current)
    clearTimeout(clickTimer.current)
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
    if (shakaRef.current?.isLive()) {
      const range = shakaRef.current.seekRange()
      if (range.end > 0) v.currentTime = range.end
    } else if (hlsRef.current?.liveSyncPosition) {
      v.currentTime = hlsRef.current.liveSyncPosition
    } else if (v.duration && isFinite(v.duration)) {
      v.currentTime = v.duration - 0.5
    }
    v.play()
  }, [])

  const setQuality = useCallback((levelId) => {
    if (shakaRef.current) {
      if (levelId === -1) {
        shakaRef.current.configure({ abr: { enabled: true } })
        update({ quality: 'Auto', showQualityMenu: false })
      } else {
        const levels = liveRef.current.qualityLevels
        const level  = levels.find((l) => l.id === levelId)
        if (level?.height) {
          shakaRef.current.configure({
            abr: { enabled: false },
            restrictions: { maxHeight: level.height, minHeight: level.height },
          })
          update({ quality: `${level.height}p`, showQualityMenu: false })
        }
      }
    } else if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId
      const lev = hlsRef.current.levels[levelId]
      update({ quality: levelId === -1 ? 'Auto' : lev?.height ? `${lev.height}p` : 'Auto', showQualityMenu: false })
    }
  }, [])

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
      <video ref={videoRef} className="w-full h-full object-contain" playsInline preload="auto" />

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
            className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
            <div className="text-center space-y-3 px-6">
              <div className="text-5xl">📡</div>
              <p className="text-white font-semibold text-base">{state.error}</p>
              <p className="text-white/40 text-sm">Stream tokens expire after ~6 hours.<br />Update the URL in channels.js with a fresh token.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seek indicator */}
      <SeekIndicator type={state.seekIndicator} />

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
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quality menu */}
      <AnimatePresence>
        {state.showQualityMenu && (
          <QualityMenu
            levels={qualityLevels}
            current={state.quality}
            onSelect={setQuality}
            onClose={() => update({ showQualityMenu: false })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
