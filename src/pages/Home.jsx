import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Radio } from 'lucide-react'
import HeroSection from '../components/UI/HeroSection'
import CategoryTabs from '../components/UI/CategoryTabs'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

export default function Home() {
  const { activeCategory, searchQuery, darkMode, channels, channelsLoading } = useStore()

  const filtered = useMemo(() => {
    let list = channels
    if (activeCategory === 'fancode') {
      list = list.filter((c) => c.key?.startsWith('fc_'))
    } else if (activeCategory !== 'all') {
      list = list.filter((c) => c.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.currentMatch.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeCategory, searchQuery])

  const liveCount = filtered.filter((c) => c.isLive).length

  return (
    <main className="flex-1 p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto w-full">
      <HeroSection />

      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-500" />
            <h2 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'}`}>All Channels</h2>
          </div>
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold px-2 py-1 rounded-full">
              <Radio size={10} className="animate-pulse" />
              {liveCount} LIVE
            </div>
          )}
        </div>
        <div className="sm:ml-auto">
          <CategoryTabs />
        </div>
      </div>

      {/* Grid */}
      {channelsLoading && channels.length <= 2 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-dark-700 border border-white/[0.06] overflow-hidden animate-pulse">
              <div className="aspect-video bg-dark-600" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-dark-500 rounded w-2/3" />
                <div className="h-4 bg-dark-500 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-white/50 text-lg font-medium">No channels found</p>
          <p className="text-white/30 text-sm mt-1">Try a different category or search</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((ch, i) => (
            <ChannelCard key={ch.id} channel={ch} index={i} />
          ))}
        </div>
      )}
    </main>
  )
}
