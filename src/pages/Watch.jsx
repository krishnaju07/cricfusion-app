import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Users, Globe, Zap, Share2,
  Heart, ChevronRight, Radio, Star, Tv2
} from 'lucide-react'
import VideoPlayer from '../components/Player/VideoPlayer'
import Sidebar from '../components/Layout/Sidebar'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

export default function Watch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setCurrentChannel, channels } = useStore()
  const [liked, setLiked] = useState(false)
  const [shareMsg, setShareMsg] = useState(false)

  const channel = channels.find((c) => c.id === Number(id))
  const related = channels.filter((c) => c.id !== Number(id) && c.isLive).slice(0, 6)
  const liveChannels = channels.filter((c) => c.isLive && c.id !== Number(id))

  useEffect(() => {
    if (channel) setCurrentChannel(channel)
    return () => setCurrentChannel(null)
  }, [channel])

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    setShareMsg(true)
    setTimeout(() => setShareMsg(false), 2000)
  }

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
      <Sidebar currentChannelId={channel.id} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-5 max-w-5xl mx-auto space-y-4">
          {/* Back */}
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            All Channels
          </motion.button>

          {/* Player */}
          <motion.div
            key={channel.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl overflow-hidden ring-1 ring-white/[0.07] shadow-2xl shadow-black/60"
          >
            <VideoPlayer channel={channel} />
          </motion.div>

          {/* Mobile channel switcher */}
          <div className="md:hidden">
            <div className="flex items-center gap-2 mb-2">
              <Radio size={14} className="text-brand-500 animate-pulse" />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Switch Channel</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {liveChannels.map((ch) => (
                <motion.button
                  key={ch.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/watch/${ch.id}`)}
                  className="flex-shrink-0 flex flex-col items-center gap-1 p-2.5 rounded-xl bg-dark-700 border border-white/[0.06] hover:border-brand-500/40 transition-all min-w-[72px]"
                >
                  <div className="w-10 h-7 rounded gradient-brand flex items-center justify-center text-[9px] font-black text-white">
                    {ch.logo}
                  </div>
                  <span className="text-white/60 text-[10px] font-medium truncate w-full text-center">{ch.name}</span>
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {channel.isLive && (
                    <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                  )}
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                    channel.badge === '4K' ? 'bg-purple-600 text-white' :
                    channel.badge === 'HD' ? 'bg-blue-600 text-white' :
                    'bg-dark-600 text-white/70'
                  }`}>
                    {channel.badge}
                  </span>
                  <span className="text-white/30 text-xs capitalize">{channel.category}</span>
                </div>
                <h1 className="text-white font-bold text-xl md:text-2xl leading-tight">{channel.currentMatch}</h1>
                <p className="text-white/50 text-sm leading-relaxed">{channel.description}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setLiked((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    liked ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'glass text-white/60 border-white/[0.07] hover:text-white'
                  }`}
                >
                  <Heart size={15} className={liked ? 'fill-red-400' : ''} />
                  <span className="hidden sm:inline">{liked ? 'Liked' : 'Like'}</span>
                </motion.button>

                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleShare}
                    className="flex items-center gap-1.5 glass text-white/60 hover:text-white px-3 py-2 rounded-xl text-sm font-semibold border border-white/[0.07] transition-colors"
                  >
                    <Share2 size={15} />
                    <span className="hidden sm:inline">Share</span>
                  </motion.button>
                  <AnimatePresence>
                    {shareMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute -top-9 left-1/2 -translate-x-1/2 bg-dark-700 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap border border-white/10"
                      >
                        Link copied!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-1.5 text-white/50">
                <Users size={13} /><span>{channel.viewers} watching</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50">
                <Globe size={13} /><span>{channel.language}</span>
              </div>
              <div className="flex items-center gap-1.5 text-brand-400">
                <Zap size={13} /><span>{channel.badge} Quality</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 capitalize">
                <Star size={13} /><span>{channel.category}</span>
              </div>
            </div>

            {/* Score card */}
            {channel.score && (
              <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border border-white/[0.06]">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-0.5">Live Score</p>
                  <p className="text-white font-bold text-sm">{channel.score}</p>
                </div>
                <div className="ml-auto">
                  <Tv2 size={18} className="text-white/20" />
                </div>
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="hidden md:flex items-center gap-3 text-white/25 text-xs flex-wrap">
              <span>Keyboard:</span>
              {[['Space','Play/Pause'],['← →','Seek 10s'],['↑ ↓','Volume'],['M','Mute'],['F','Fullscreen'],['P','PiP'],['L','Go Live']].map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <kbd className="bg-dark-700 border border-white/10 text-white/40 px-1.5 py-0.5 rounded text-[10px] font-mono">{k}</kbd>
                  <span>{v}</span>
                </span>
              ))}
            </div>
          </motion.div>

          {/* Related */}
          {related.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="space-y-3 pt-1 border-t border-white/[0.05]"
            >
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  <Radio size={15} className="text-brand-500" />
                  <h3 className="text-white font-bold">More Live Now</h3>
                  <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    {related.length}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                >
                  See all <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {related.map((ch, i) => <ChannelCard key={ch.id} channel={ch} index={i} />)}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
