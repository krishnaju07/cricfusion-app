import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Users, Globe, Zap, Share2, Link2, Check,
  Heart, ChevronRight, Radio, Tv2, X, Search
} from 'lucide-react'
import VideoPlayer from '../components/Player/VideoPlayer'
import Sidebar from '../components/Layout/Sidebar'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

const VPN_FLAG = { DE: '🇩🇪', AT: '🇦🇹', BE: '🇧🇪', SK: '🇸🇰', CZ: '🇨🇿', FR: '🇫🇷', IE: '🇮🇪', CA: '🇨🇦', SA: '🇸🇦', BR: '🇧🇷', TR: '🇹🇷' }

export default function Watch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setCurrentChannel, channels, favorites, toggleFavorite } = useStore()
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showChannelSheet, setShowChannelSheet] = useState(false)
  const [sheetSearch, setSheetSearch] = useState('')
  const sharePanelRef = useRef(null)
  const playerRef = useRef(null)
  const mainRef   = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const playerLockedRef = useRef(false)

  const channel = channels.find((c) => c.key === id)
  const liked = favorites.includes(channel?.id)

  // Same category first, then other live channels
  const others = channels.filter((c) => c.key !== id && c.isLive)
  const sameCategory = others.filter((c) => c.category === channel?.category)
  const different   = others.filter((c) => c.category !== channel?.category)
  const related     = [...sameCategory, ...different].slice(0, 12)
  const liveChannels = [...sameCategory, ...different]

  // Ordered list including current channel (for swipe prev/next)
  const navList = channel ? [channel, ...sameCategory, ...different] : liveChannels
  const navIdx  = navList.findIndex((c) => c.key === id)
  const prevCh  = navIdx > 0 ? navList[navIdx - 1] : null
  const nextCh  = navIdx < navList.length - 1 ? navList[navIdx + 1] : null

  // Sheet search filter across ALL live channels
  const sheetChannels = useMemo(() => {
    const all = channel ? [channel, ...sameCategory, ...different] : liveChannels
    if (!sheetSearch.trim()) return all
    const q = sheetSearch.toLowerCase()
    return all.filter((c) => c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q))
  }, [channel, sameCategory, different, liveChannels, sheetSearch])

  useEffect(() => {
    if (channel) setCurrentChannel(channel)
    return () => setCurrentChannel(null)
  }, [channel])

  // Scroll content area to top on channel change
  useEffect(() => {
    if (!channel) return
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [channel?.id])

  // Close panel when clicking outside
  useEffect(() => {
    if (!showSharePanel) return
    const handler = (e) => {
      if (sharePanelRef.current && !sharePanelRef.current.contains(e.target)) {
        setShowSharePanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSharePanel])

  const shareUrl  = window.location.href
  const shareText = channel ? `Watch ${channel.currentMatch} LIVE on CricFusion!` : 'Watch live cricket on CricFusion!'

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try { await navigator.share({ title: shareText, url: shareUrl }) } catch (_) {}
      return
    }
    setShowSharePanel((v) => !v)
  }, [shareText, shareUrl])

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  const openShare = useCallback((href) => {
    window.open(href, '_blank', 'noopener,noreferrer,width=600,height=480')
    setShowSharePanel(false)
  }, [])

  // Swipe left/right on player → navigate channels (mobile)
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (playerLockedRef.current) return
    if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx) * 0.8) return
    if (dx < 0 && nextCh) navigate(`/watch/${encodeURIComponent(nextCh.key)}`)
    if (dx > 0 && prevCh) navigate(`/watch/${encodeURIComponent(prevCh.key)}`)
  }, [nextCh, prevCh, navigate])

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">📺</div>
          <p className="text-white/60 text-xl font-semibold">Channel not found</p>
          <button
            onClick={() => navigate('/')}
            className="gradient-brand text-white px-6 py-2.5 rounded-xl font-bold shadow-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Desktop sidebar */}
      <Sidebar currentChannelId={channel.key} />

      <main ref={mainRef} className="flex-1 overflow-y-auto bg-black">

        {/* ── Player zone ──────────────────────────────────────────────────── */}
        {/* Mobile: full-width, no padding, no rounding */}
        {/* Desktop: padded, max-width, rounded */}
        <div className="relative md:pt-5 md:px-5 md:max-w-5xl md:mx-auto">

          {/* Back button — floats over player on mobile */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={() => navigate(-1)}
            className="md:hidden absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10"
          >
            <ArrowLeft size={13} />
            Back
          </motion.button>

          <motion.div
            ref={playerRef}
            key={channel.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="overflow-hidden md:rounded-2xl md:ring-1 md:ring-white/[0.07] md:shadow-2xl md:shadow-black/60"
          >
            <VideoPlayer
              channel={channel}
              onLockChange={(locked) => { playerLockedRef.current = locked }}
            />
          </motion.div>
        </div>

        {/* ── Info + related ───────────────────────────────────────────────── */}
        <div className="px-4 md:px-5 max-w-5xl mx-auto pb-28 md:pb-8 space-y-4 md:space-y-5 pt-3 md:pt-4">

          {/* Desktop back button */}
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="hidden md:flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            All Channels
          </motion.button>

          {/* Title + action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {channel.isLive && (
                    <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                  )}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    channel.badge === '4K' ? 'bg-purple-600 text-white' :
                    channel.badge === '2K' ? 'bg-indigo-500 text-white' :
                    channel.badge === 'HD' ? 'bg-blue-600 text-white' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {channel.badge}
                  </span>
                  <span className="text-white/25 text-[10px] capitalize">{channel.category}</span>
                </div>
                {/* Match title */}
                <h1 className="text-white font-bold text-sm md:text-xl leading-snug line-clamp-2">
                  {channel.currentMatch}
                </h1>
                {/* Description — desktop only */}
                <p className="hidden sm:block text-white/40 text-sm leading-relaxed">{channel.description}</p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggleFavorite(channel.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 md:px-3 rounded-xl text-xs font-semibold transition-all border ${
                    liked
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-white/[0.06] text-white/60 border-white/[0.08] hover:text-white'
                  }`}
                >
                  <Heart size={14} className={liked ? 'fill-red-400' : ''} />
                  <span className="hidden sm:inline">{liked ? 'Liked' : 'Like'}</span>
                </motion.button>

                <div className="relative" ref={sharePanelRef}>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleShare}
                    className={`flex items-center gap-1.5 px-2.5 py-2 md:px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      showSharePanel
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                        : 'bg-white/[0.06] text-white/60 hover:text-white border-white/[0.08]'
                    }`}
                  >
                    <Share2 size={14} />
                    <span className="hidden sm:inline">Share</span>
                  </motion.button>

                  <AnimatePresence>
                    {showSharePanel && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-11 z-50 bg-[#1c1c1c] rounded-2xl shadow-2xl border border-white/10 overflow-hidden min-w-[210px]"
                      >
                        <p className="px-4 pt-3 pb-2 text-white/40 text-[10px] font-semibold uppercase tracking-wider">Share this match</p>
                        <button onClick={handleCopy} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors">
                          {copied ? <Check size={16} className="text-green-400 flex-shrink-0" /> : <Link2 size={16} className="text-white/50 flex-shrink-0" />}
                          <span className="text-white text-sm">{copied ? 'Link copied!' : 'Copy link'}</span>
                        </button>
                        <div className="h-px bg-white/[0.06] mx-4" />
                        <button onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors">
                          <span className="w-4 h-4 flex-shrink-0 text-[15px] leading-none">💬</span>
                          <span className="text-white text-sm">WhatsApp</span>
                        </button>
                        <button onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors">
                          <span className="w-4 h-4 flex-shrink-0 font-black text-white/70 text-[13px]">𝕏</span>
                          <span className="text-white text-sm">Twitter / X</span>
                        </button>
                        <button onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`)} className="w-full flex items-center gap-3 px-4 pb-3 pt-2.5 hover:bg-white/10 transition-colors">
                          <span className="w-4 h-4 flex-shrink-0 text-[15px] leading-none">✈️</span>
                          <span className="text-white text-sm">Telegram</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Score card */}
            {channel.score && (
              <div className="bg-white/[0.05] rounded-xl px-4 py-3 flex items-center gap-3 border border-white/[0.06]">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-0.5">Live Score</p>
                  <p className="text-white font-bold text-sm">{channel.score}</p>
                </div>
              </div>
            )}

            {/* Stats row — desktop only */}
            <div className="hidden sm:flex items-center gap-4 text-xs pt-0.5">
              <div className="flex items-center gap-1.5 text-white/40">
                <Globe size={12} /><span>{channel.language}</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-400/80">
                <Zap size={12} /><span>{channel.badge} Quality</span>
              </div>
              {channel.viewers && channel.viewers !== '—' && (
                <div className="flex items-center gap-1.5 text-white/40">
                  <Users size={12} /><span>{channel.viewers} watching</span>
                </div>
              )}
            </div>

            {/* Keyboard shortcuts — desktop only */}
            <div className="hidden md:flex items-center gap-3 text-white/20 text-xs flex-wrap">
              <span>Keyboard:</span>
              {[['Space','Play/Pause'],['← →','Seek 10s'],['↑ ↓','Volume'],['M','Mute'],['F','Fullscreen'],['P','PiP'],['L','Go Live']].map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <kbd className="bg-white/[0.06] border border-white/10 text-white/35 px-1.5 py-0.5 rounded text-[10px] font-mono">{k}</kbd>
                  <span>{v}</span>
                </span>
              ))}
            </div>
          </motion.div>

          {/* ── Related channels ─────────────────────────────────────────── */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="space-y-3 pt-1 border-t border-white/[0.05]"
            >
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Radio size={13} className="text-brand-500 animate-pulse" />
                  <h3 className="text-white font-bold text-sm capitalize">
                    {sameCategory.length > 0 ? `More ${channel.category}` : 'More Live'}
                  </h3>
                  <span className="text-[10px] bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    {liveChannels.length}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-0.5 text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
                >
                  See all <ChevronRight size={13} />
                </button>
              </div>

              {/* Quick-switch horizontal strip */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {liveChannels.slice(0, 30).map((ch) => (
                  <motion.button
                    key={ch.key}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => navigate(`/watch/${encodeURIComponent(ch.key)}`)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border transition-all min-w-[64px] ${
                      ch.category === channel.category
                        ? 'bg-brand-500/10 border-brand-500/30'
                        : 'bg-white/[0.04] border-white/[0.06] active:bg-white/10'
                    }`}
                  >
                    <div className={`w-9 h-6 rounded flex items-center justify-center text-[8px] font-black ${
                      ch.category === channel.category ? 'gradient-brand text-black' : 'bg-dark-600 text-white/70'
                    }`}>
                      {ch.logo}
                    </div>
                    <span className="text-white/55 text-[9px] font-medium truncate w-full text-center leading-tight">
                      {ch.name.replace(/\s*\(.*?\)\s*/g, '').slice(0, 9)}
                    </span>
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  </motion.button>
                ))}
              </div>

              {/* Card grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {related.map((ch, i) => <ChannelCard key={ch.key} channel={ch} index={i} />)}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* ── Mobile: floating channel switcher ───────────────────────────────── */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowChannelSheet(true)}
          className="flex items-center gap-2 gradient-brand text-black font-bold px-4 py-3 rounded-2xl shadow-2xl shadow-black/50"
        >
          <Tv2 size={16} />
          <span className="text-sm">Channels</span>
          <span className="bg-black/20 text-black/70 text-[10px] font-black px-1.5 py-0.5 rounded-full">
            {liveChannels.length}
          </span>
        </motion.button>
      </div>

      {/* ── Mobile: channel bottom sheet ────────────────────────────────────── */}
      <AnimatePresence>
        {showChannelSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChannelSheet(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-[#111] rounded-t-3xl border-t border-white/10 flex flex-col"
              style={{ maxHeight: '82vh' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <Radio size={14} className="text-brand-500 animate-pulse" />
                  <h3 className="text-white font-bold text-sm">Live Channels</h3>
                  <span className="text-[10px] bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    {liveChannels.length}
                  </span>
                </div>
                <button onClick={() => setShowChannelSheet(false)} className="text-white/40 p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="relative flex items-center">
                  <Search size={13} className="absolute left-3 text-white/30 pointer-events-none" />
                  <input
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Search channels…"
                    className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/25 py-2.5 pl-8 pr-4 outline-none focus:border-brand-500/40 transition-colors"
                  />
                  {sheetSearch && (
                    <button onClick={() => setSheetSearch('')} className="absolute right-3 text-white/30">
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-3 pb-8 space-y-1">
                {sheetChannels.map((ch) => {
                  const isActive = ch.key === channel.key
                  return (
                    <button
                      key={ch.key}
                      onClick={() => { navigate(`/watch/${encodeURIComponent(ch.key)}`); setShowChannelSheet(false); setSheetSearch('') }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        isActive ? 'bg-brand-500/20 border-brand-500/40' : 'bg-white/[0.04] border-white/[0.06] active:bg-white/10'
                      }`}
                    >
                      <div className={`w-12 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black ${
                        isActive ? 'gradient-brand text-black' : 'bg-dark-600 text-white/70'
                      }`}>
                        {ch.logo?.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-brand-400' : 'text-white/85'}`}>
                          {ch.name}
                        </p>
                        <p className="text-white/35 text-[11px] truncate mt-0.5 capitalize">{ch.currentMatch || ch.category}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {ch.vpn && VPN_FLAG[ch.vpn] && (
                          <span className="text-[11px]">{VPN_FLAG[ch.vpn]}</span>
                        )}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          ch.badge === '4K' ? 'bg-purple-600/80 text-white' :
                          ch.badge === 'HD' ? 'bg-blue-600/80 text-white' : 'bg-dark-600 text-white/50'
                        }`}>{ch.badge}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-brand-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
