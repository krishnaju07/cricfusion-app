import { useMemo } from 'react'
import { motion } from 'framer-motion'
import HeroSection from '../components/UI/HeroSection'
import CategoryTabs from '../components/UI/CategoryTabs'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

export default function Home() {
  const { activeCategory, searchQuery, channels, channelsLoading } = useStore()

  const filtered = useMemo(() => {
    let list = channels
    if (activeCategory === 'fancode') {
      list = list.filter((c) => c.key?.startsWith('fc_'))
    } else if (activeCategory === 'sonyliv') {
      list = list.filter((c) => c.key?.startsWith('sl_'))
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
  }, [activeCategory, searchQuery, channels])

  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      {/* Hero carousel — full bleed, no horizontal padding */}
      <HeroSection />

      {/* Category tabs */}
      <div className="px-4 md:px-6 pt-5 pb-3">
        <CategoryTabs />
      </div>

      {/* Channel grid */}
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
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-white/50 text-lg font-medium">No channels found</p>
            <p className="text-white/30 text-sm mt-1">Try a different category or search</p>
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
