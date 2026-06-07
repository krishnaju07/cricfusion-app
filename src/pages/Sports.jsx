import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import CategoryTabs from '../components/UI/CategoryTabs'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

export default function Sports() {
  const { activeCategory, setActiveCategory, channels, channelsLoading } = useStore()

  // Ensure "all" is active when landing on Sports for the first time
  // (user may have had a category filtered on Home)
  const filtered = useMemo(() => {
    if (activeCategory === 'fancode') return channels.filter((c) => c.key?.startsWith('fc_'))
    if (activeCategory === 'sonyliv')  return channels.filter((c) => c.key?.startsWith('sl_'))
    if (activeCategory !== 'all')      return channels.filter((c) => c.category === activeCategory)
    return channels
  }, [activeCategory, channels])

  const liveCount = filtered.filter((c) => c.isLive).length

  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      {/* Header */}
      <div className="px-4 md:px-6 pt-5 pb-1 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Trophy size={16} className="text-brand-500" />
        </div>
        <h1 className="text-white font-black text-xl" style={{ fontFamily: 'Oswald, sans-serif' }}>
          ALL SPORTS
        </h1>
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {liveCount} LIVE
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="px-4 md:px-6 pt-4 pb-3">
        <CategoryTabs />
      </div>

      {/* Grid */}
      <div className="px-4 md:px-6 pb-6">
        {channelsLoading && channels.length <= 2 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[#141414] border border-white/[0.05] overflow-hidden animate-pulse">
                <div className="aspect-video bg-[#1e1e1e]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-[#222] rounded w-full" />
                  <div className="h-3 bg-[#222] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="text-5xl mb-4">📺</div>
            <p className="text-white/50 text-lg font-medium">No channels in this category</p>
            <button
              onClick={() => setActiveCategory('all')}
              className="mt-4 px-5 py-2 rounded-full border border-white/10 text-white/50 text-sm hover:text-white hover:border-brand-500/50 transition-colors"
            >
              Show all
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((ch, i) => (
              <ChannelCard key={ch.id} channel={ch} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
