import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import HeroSection from '../components/UI/HeroSection'
import CategoryTabs from '../components/UI/CategoryTabs'
import ChannelCard from '../components/UI/ChannelCard'
import PullIndicator from '../components/UI/PullIndicator'
import { useStore } from '../store/useStore'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { usePagedList } from '../hooks/usePagedList'

const TP_SECTIONS = [
  { id: 'cricket',    label: 'Cricket',    icon: '🏏' },
  { id: 'football',   label: 'Football',   icon: '⚽' },
  { id: 'tennis',     label: 'Tennis',     icon: '🎾' },
  { id: 'basketball', label: 'Basketball', icon: '🏀' },
  { id: 'formula1',   label: 'Formula 1',  icon: '🏎️' },
  { id: 'boxing',     label: 'Boxing',     icon: '🥊' },
  { id: 'multi',      label: 'Multi Sports', icon: '🎯' },
]

const ROW_LIMIT = 8   // cards visible before "See all"
const GRID_PAGE = 20  // cards per page in expanded grid

function TpGroupedView({ channels }) {
  const [expanded, setExpanded] = useState(null)
  const [gridPage, setGridPage] = useState(1)

  const grouped = useMemo(() => {
    const map = {}
    for (const ch of channels) {
      const cat = ch.category || 'multi'
      if (!map[cat]) map[cat] = []
      map[cat].push(ch)
    }
    return map
  }, [channels])

  const sections = TP_SECTIONS.filter((s) => grouped[s.id]?.length)

  const handleExpand = (id) => {
    if (expanded === id) { setExpanded(null) }
    else { setExpanded(id); setGridPage(1) }
  }

  if (!sections.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">📡</div>
      <p className="text-white/50 text-lg font-medium">No Tata Play channels</p>
      <p className="text-white/30 text-sm mt-1">Add your M3U playlist in Account settings</p>
    </div>
  )

  return (
    <div className="pb-6 space-y-6">
      {sections.map((sec) => {
        const isExpanded = expanded === sec.id
        const list = grouped[sec.id]
        const gridVisible = list.slice(0, gridPage * GRID_PAGE)
        const hasMore = gridVisible.length < list.length

        return (
          <div key={sec.id}>
            {/* Section header */}
            <div className="flex items-center gap-2 px-4 md:px-6 mb-3">
              <span className="text-base leading-none">{sec.icon}</span>
              <span className="text-white font-bold text-sm">{sec.label}</span>
              <span className="text-[10px] bg-white/[0.07] text-white/40 px-1.5 py-0.5 rounded-full font-semibold">
                {list.length}
              </span>
              {list.length > ROW_LIMIT && (
                <button
                  onClick={() => handleExpand(sec.id)}
                  className="ml-auto text-[12px] font-semibold text-brand-400 active:text-brand-300"
                >
                  {isExpanded ? 'Collapse ↑' : `See all ${list.length} →`}
                </button>
              )}
            </div>

            {/* Horizontal scroll row — capped at ROW_LIMIT */}
            {!isExpanded && (
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-6 pb-1">
                {list.slice(0, ROW_LIMIT).map((ch, i) => (
                  <div key={ch.id} className="flex-shrink-0 w-44">
                    <ChannelCard channel={ch} index={i} animated={false} />
                  </div>
                ))}
              </div>
            )}

            {/* Expanded grid — paged */}
            {isExpanded && (
              <div className="px-4 md:px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {gridVisible.map((ch, i) => (
                    <ChannelCard key={ch.id} channel={ch} index={i} animated={false} />
                  ))}
                </div>
                {hasMore && (
                  <button
                    onClick={() => setGridPage((p) => p + 1)}
                    className="mt-4 w-full py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/70 hover:border-white/20 transition-colors"
                  >
                    Load more ({list.length - gridVisible.length} remaining)
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Home() {
  const { activeCategory, searchQuery, channels, channelsLoading, favorites } = useStore()
  const { containerRef, pullY, refreshing, threshold } = usePullToRefresh(() => window.location.reload())

  const tpChannels = useMemo(
    () => channels.filter((c) => c.key?.startsWith('tp_')),
    [channels]
  )

  const favoriteChannels = useMemo(
    () => channels.filter((c) => favorites.includes(c.id)),
    [channels, favorites]
  )

  const filtered = useMemo(() => {
    let list = channels
    if (activeCategory === 'fancode') {
      list = list.filter((c) => c.key?.startsWith('fc_'))
    } else if (activeCategory === 'sonyliv') {
      list = list.filter((c) => c.key?.startsWith('sl_'))
    } else if (activeCategory === 'tataplay') {
      list = list.filter((c) => c.key?.startsWith('tp_'))
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

  const { visible, hasMore, sentinelRef } = usePagedList(filtered, containerRef)
  const animated = filtered.length <= 40

  // Tata Play tab: grouped rows view (skip when searching)
  const showTpGrouped = activeCategory === 'tataplay' && !searchQuery.trim()

  return (
    <main ref={containerRef} className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      <PullIndicator pullY={pullY} refreshing={refreshing} threshold={threshold} />

      <HeroSection />

      <div className="px-4 md:px-6 pt-5 pb-3">
        <CategoryTabs />
      </div>

      {/* Favourites row — only on trending tab with no active search */}
      {favoriteChannels.length > 0 && activeCategory === 'all' && !searchQuery.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-1"
        >
          <div className="flex items-center gap-2 px-4 md:px-6 mb-2.5">
            <Heart size={13} className="text-red-400 fill-red-400" />
            <span className="text-white font-bold text-sm">Favourites</span>
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
              {favoriteChannels.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-6 pb-3">
            {favoriteChannels.map((ch, i) => (
              <div key={ch.id} className="flex-shrink-0 w-44">
                <ChannelCard channel={ch} index={i} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tata Play grouped sections */}
      {showTpGrouped ? (
        channelsLoading && tpChannels.length === 0 ? (
          <div className="px-4 md:px-6 pb-6 space-y-6">
            {[1, 2].map((s) => (
              <div key={s}>
                <div className="h-4 w-28 bg-white/[0.07] rounded mb-3 mx-4 animate-pulse" />
                <div className="flex gap-3 px-4 overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-44 rounded-2xl bg-[#141414] border border-white/[0.05] overflow-hidden animate-pulse">
                      <div className="aspect-video bg-[#1e1e1e]" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 bg-[#222] rounded w-full" />
                        <div className="h-3 bg-[#222] rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TpGroupedView channels={tpChannels} />
        )
      ) : (
        /* Normal grid for all other tabs */
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
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
                {visible.map((ch, i) => (
                  <ChannelCard key={ch.id} channel={ch} index={i} animated={animated} />
                ))}
              </div>
              {hasMore && <div ref={sentinelRef} className="h-4" />}
            </>
          )}
        </div>
      )}
    </main>
  )
}
