import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'
import { VPN_FLAG, VPN_NAME, getChannelSource } from '../../constants/channelMeta'

export default function ChannelCard({ channel, index = 0, animated = true }) {
  const navigate = useNavigate()
  const cardRef  = useRef(null)
  const [imgFailed, setImgFailed] = useState(false)
  const thumbSrc = channel.thumbnail || channel.logoUrl || null
  const [hovered, setHovered]     = useState(false)
  const [tilt, setTilt]           = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    setTilt({ x: y * -9, y: x * 9 })
  }, [])

  const resetTilt = useCallback(() => {
    setHovered(false)
    setTilt({ x: 0, y: 0 })
  }, [])

  const entryProps = animated
    ? { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: Math.min(index, 14) * 0.04, duration: 0.32, ease: 'easeOut' } }
    : {}

  const source = getChannelSource(channel)

  // Primary: always the channel name.
  // Secondary: live match/event if it differs from the name; otherwise show source.
  const primaryText = channel.name
  const secondaryText = (channel.currentMatch && channel.currentMatch !== channel.name)
    ? channel.currentMatch
    : (source || channel.category || '')

  return (
    <motion.div
      ref={cardRef}
      {...entryProps}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={resetTilt}
      onClick={() => navigate(`/watch/${encodeURIComponent(channel.key)}`)}
      style={{ perspective: 900, WebkitTapHighlightColor: 'transparent', cursor: 'pointer' }}
    >
      <motion.div
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
          scale: hovered ? 1.028 : 1,
          boxShadow: hovered
            ? '0 22px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(200,255,0,0.18)'
            : '0 2px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
        transition={{ type: 'spring', stiffness: 270, damping: 22 }}
        className={`rounded-2xl overflow-hidden bg-[#141414] ${channel.status === 'down' ? 'opacity-60' : ''}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* ── Thumbnail ── */}
        <div className="relative overflow-hidden aspect-video">
          {imgFailed || !thumbSrc ? (
            <div className="w-full h-full bg-gradient-to-br from-[#1c1c1c] to-[#0a0a0a] flex items-center justify-center">
              <span className="text-white/15 font-black text-2xl tracking-tight">{channel.logo}</span>
            </div>
          ) : (
            <motion.img
              src={thumbSrc}
              alt={channel.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgFailed(true)}
              animate={{ scale: hovered ? 1.08 : 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          )}

          {/* Gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

          {/* Play button overlay */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <motion.div
                  initial={{ scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.55, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  style={{ width: 52, height: 52, background: '#c8ff00', boxShadow: '0 0 36px rgba(200,255,0,0.55)', borderRadius: '50%' }}
                  className="flex items-center justify-center"
                >
                  <Play size={18} fill="#000" className="text-black ml-0.5" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offline overlay */}
          {channel.status === 'down' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <span className="text-[10px] font-black tracking-wider text-red-400 bg-black/70 px-2 py-1 rounded">
                OFFLINE
              </span>
            </div>
          )}

          {/* Top-left: LIVE / OFFLINE badge */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-20">
            {channel.status === 'down' ? (
              <span className="flex items-center gap-1 bg-red-900/80 text-red-300 text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider">
                OFFLINE
              </span>
            ) : channel.isLive ? (
              <span className="flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            ) : <span />}

            {/* Top-right: quality + HQ + VPN badges */}
            <div className="flex items-center gap-1">
              {channel.status === 'hq' && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded backdrop-blur-sm bg-yellow-500/90 text-black">
                  ★ HQ
                </span>
              )}
              {channel.vpn && VPN_FLAG[channel.vpn] && (
                <span
                  title={`${VPN_NAME[channel.vpn] || channel.vpn} VPN required`}
                  className="text-[9px] font-black px-1.5 py-0.5 rounded backdrop-blur-sm bg-orange-500/90 text-white"
                >
                  {VPN_FLAG[channel.vpn]} VPN
                </span>
              )}
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded backdrop-blur-sm ${
                channel.badge === '4K' ? 'bg-purple-600/90 text-white' :
                channel.badge === '2K' ? 'bg-indigo-500/90 text-white' :
                channel.badge === 'HD' ? 'bg-blue-600/80 text-white' :
                'bg-black/50 text-white/60'
              }`}>
                {channel.badge}
              </span>
            </div>
          </div>

          {/* Score (FIFA / live match) */}
          {channel.score && (
            <div className="absolute bottom-2 left-2.5 right-2.5">
              <span className="text-white/80 text-[11px] font-semibold line-clamp-1">{channel.score}</span>
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div className="px-3 pt-2.5 pb-3 space-y-1.5">
          {/* Channel name */}
          <p className="text-white font-semibold text-sm leading-snug line-clamp-1">
            {primaryText}
          </p>

          {/* Match / source row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(200,255,0,0.10)' }}
              >
                <span className="text-[7px] font-black" style={{ color: '#c8ff00' }}>
                  {channel.logo?.slice(0, 3)}
                </span>
              </div>
              <span className="text-white/40 text-xs truncate">
                {secondaryText}
              </span>
            </div>

            {/* Source pill */}
            {source && (
              <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/[0.07] text-white/30 border border-white/[0.06]">
                {source}
              </span>
            )}
          </div>
        </div>

        {/* Shine effect on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, transparent 55%)' }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
