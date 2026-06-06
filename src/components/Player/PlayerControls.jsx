import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  Maximize, Minimize, PictureInPicture2, Settings,
  Radio, SkipBack, SkipForward, Lock
} from 'lucide-react'
import { formatTime } from '../../utils/formatTime'

export default function PlayerControls({
  state, channel,
  onPlayPause, onSeek, onSeekTo, onVolume, onMute,
  onFullscreen, onPIP, onGoLive, onToggleQuality, onLock
}) {
  const { playing, muted, volume, currentTime, duration, buffered, fullscreen, isLive } = state
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0

  const [hoverTime, setHoverTime] = useState(null)
  const [hoverPct, setHoverPct] = useState(0)
  const [showVol, setShowVol] = useState(false)
  const progressRef = useRef(null)

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  const handleProgressMouseMove = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverPct(pct * 100)
    setHoverTime(pct * (duration || 0))
  }, [duration])

  const handleProgressClick = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeekTo(pct * (duration || 0))
  }, [duration, onSeekTo])

  const handleProgressLeave = () => setHoverTime(null)

  // Touch seek
  const handleProgressTouch = useCallback((e) => {
    e.stopPropagation()
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect) return
    const touch = e.touches[0]
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
    onSeekTo(pct * (duration || 0))
  }, [duration, onSeekTo])

  return (
    <div
      className="px-3 pb-3 md:px-4 md:pb-4 space-y-1.5 relative z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Progress bar ── */}
      <div className="flex items-center gap-2">
        <span className="text-white/70 text-xs tabular-nums w-10 text-right flex-shrink-0">
          {isLive ? 'LIVE' : formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          className="relative flex-1 h-5 flex items-center cursor-pointer group/prog"
          onClick={handleProgressClick}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressLeave}
          onTouchStart={handleProgressTouch}
          onTouchMove={handleProgressTouch}
        >
          {/* Hover time tooltip */}
          <AnimatePresence>
            {hoverTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute -top-8 -translate-x-1/2 bg-dark-800 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none z-20 whitespace-nowrap"
                style={{ left: `${hoverPct}%` }}
              >
                {formatTime(hoverTime)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Track */}
          <div className="absolute inset-x-0 h-1 group-hover/prog:h-1.5 transition-all duration-100 rounded-full bg-white/20">
            {/* Buffered */}
            <div className="absolute inset-y-0 left-0 bg-white/35 rounded-full transition-all" style={{ width: `${bufferedPct}%` }} />
            {/* Played */}
            <div className="absolute inset-y-0 left-0 bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-brand-400 rounded-full shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {!isLive && (
          <span className="text-white/70 text-xs tabular-nums w-10 flex-shrink-0">
            {formatTime(duration)}
          </span>
        )}
      </div>

      {/* ── Button row ── */}
      <div className="flex items-center justify-between">
        {/* Left group */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Skip back 10s */}
          <ControlBtn onClick={() => onSeek(-10)} title="Back 10s (←)">
            <div className="relative flex items-center justify-center w-full h-full">
              <SkipBack size={17} />
              <span className="absolute bottom-0 text-[7px] font-black leading-none">10</span>
            </div>
          </ControlBtn>

          {/* Play / Pause */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={onPlayPause}
            className="w-10 h-10 flex items-center justify-center rounded-full gradient-brand text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/60 transition-shadow flex-shrink-0 mx-1"
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            <AnimatePresence mode="wait">
              {playing
                ? <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><Pause size={17} /></motion.div>
                : <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><Play size={17} className="ml-0.5" /></motion.div>
              }
            </AnimatePresence>
          </motion.button>

          {/* Skip forward 10s */}
          <ControlBtn onClick={() => onSeek(10)} title="Forward 10s (→)">
            <div className="relative flex items-center justify-center w-full h-full">
              <SkipForward size={17} />
              <span className="absolute bottom-0 text-[7px] font-black leading-none">10</span>
            </div>
          </ControlBtn>

          {/* Volume */}
          <div
            className="flex items-center gap-1 ml-1"
            onMouseEnter={() => setShowVol(true)}
            onMouseLeave={() => setShowVol(false)}
          >
            <ControlBtn onClick={onMute} title={muted ? 'Unmute (M)' : 'Mute (M)'}>
              <VolumeIcon size={17} />
            </ControlBtn>

            <AnimatePresence>
              {showVol && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="relative w-20 h-5 flex items-center px-1">
                    {/* Track */}
                    <div className="absolute inset-x-1 h-1 bg-white/20 rounded-full">
                      <div className="h-full bg-white rounded-full" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                    </div>
                    {/* Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none"
                      style={{ left: `calc(4px + ${(muted ? 0 : volume) * 100}% * 72 / 80)` }}
                    />
                    <input
                      type="range" min={0} max={1} step={0.02}
                      value={muted ? 0 : volume}
                      onChange={(e) => onVolume(Number(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Volume % badge */}
            <span className="hidden md:block text-white/40 text-xs tabular-nums w-6 text-center">
              {muted ? 0 : Math.round(volume * 100)}
            </span>
          </div>

          {/* Score pill (desktop) */}
          {channel?.score && (
            <div className="hidden lg:flex items-center gap-1.5 glass text-white/80 text-xs px-2.5 py-1 rounded-full ml-1 border border-white/10">
              <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
              {channel.score}
            </div>
          )}
        </div>

        {/* Right group */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Go Live */}
          {channel?.isLive && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onGoLive}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black px-2.5 py-1.5 rounded-lg transition-colors neon-red"
              title="Jump to Live (L)"
            >
              <Radio size={11} className="animate-pulse" />
              <span className="hidden sm:inline">LIVE</span>
            </motion.button>
          )}

          {/* Quality */}
          <ControlBtn onClick={onToggleQuality} title="Quality (Q)" active={state.showQualityMenu}>
            <Settings size={15} className={state.showQualityMenu ? 'animate-spin-slow' : ''} />
          </ControlBtn>

          {/* PiP */}
          {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
            <ControlBtn onClick={onPIP} title="Picture-in-Picture (P)" active={state.pip}>
              <PictureInPicture2 size={15} />
            </ControlBtn>
          )}

          {/* Lock controls */}
          <ControlBtn onClick={onLock} title="Lock controls">
            <Lock size={15} />
          </ControlBtn>

          {/* Fullscreen */}
          <ControlBtn onClick={onFullscreen} title={fullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}>
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </ControlBtn>
        </div>
      </div>
    </div>
  )
}

function ControlBtn({ onClick, title, children, active }) {
  return (
    <motion.button
      whileTap={{ scale: 0.82 }}
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
        active ? 'text-brand-400 bg-brand-500/20 ring-1 ring-brand-500/40' : 'text-white/75 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </motion.button>
  )
}
