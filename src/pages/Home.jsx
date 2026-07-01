import { useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Heart, ChevronRight } from 'lucide-react'
import HeroSection from '../components/UI/HeroSection'
import CategoryTabs from '../components/UI/CategoryTabs'
import ChannelCard from '../components/UI/ChannelCard'
import PullIndicator from '../components/UI/PullIndicator'
import { useStore } from '../store/useStore'
import { fifaStatusOf, FIFA_SORT_WEIGHT } from '../data/channels'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { usePagedList } from '../hooks/usePagedList'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_LIMIT  = 8
const GRID_PAGE  = 20

const QUALITY_FILTERS = [
  { label: 'All', value: null },
  { label: 'HD',  value: 'HD' },
  { label: '4K',  value: '4K' },
  { label: '2K',  value: '2K' },
]

const TRENDING_SECTIONS = [
  { id: 'wc2026live', label: 'WC 2026 Live',        icon: '⚽' },
  { id: 'fifa2026',   label: 'FIFA World Cup 2026', icon: '🏆' },
  { id: 'cricket',    label: 'Cricket',             icon: '🏏' },
  { id: 'football',   label: 'Football',            icon: '⚽' },
  { id: 'tennis',     label: 'Tennis',              icon: '🎾' },
  { id: 'basketball', label: 'Basketball',          icon: '🏀' },
  { id: 'formula1',   label: 'Formula 1',           icon: '🏎️' },
  { id: 'boxing',     label: 'Boxing',              icon: '🥊' },
  { id: 'multi',      label: 'Multi Sports',        icon: '🎯' },
  { id: 'iptvsports', label: 'IPTV Sports',         icon: '📡' },
  { id: 'tamil',      label: 'Tamil',               icon: '🎬' },
]

const TP_SECTIONS = [
  { id: 'cricket',    label: 'Cricket',      icon: '🏏' },
  { id: 'football',   label: 'Football',     icon: '⚽' },
  { id: 'tennis',     label: 'Tennis',       icon: '🎾' },
  { id: 'basketball', label: 'Basketball',   icon: '🏀' },
  { id: 'formula1',   label: 'Formula 1',    icon: '🏎️' },
  { id: 'boxing',     label: 'Boxing',       icon: '🥊' },
  { id: 'multi',      label: 'Multi Sports', icon: '🎯' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferIptvSport(name) {
  const n = name.toLowerCase()
  if (/cricket/.test(n))                                  return 'Cricket'
  if (/football|soccer|liga|gol|futbol|fussball/.test(n)) return 'Football'
  if (/tennis/.test(n))                                   return 'Tennis'
  if (/golf/.test(n))                                     return 'Golf'
  if (/basket|nba/.test(n))                               return 'Basketball'
  if (/formula|f1\b|racing|nascar|indy/.test(n))          return 'Racing'
  if (/fight|ufc|boxing|mma|combat|kickbox|bellator/.test(n)) return 'Combat Sports'
  if (/hockey|nhl/.test(n))                               return 'Hockey'
  if (/rugby/.test(n))                                    return 'Rugby'
  if (/motor|moto/.test(n))                               return 'Motorsport'
  return 'General Sports'
}

function inferTamilType(name) {
  const n = name.toLowerCase()
  if (/news|seithigal|thalaimurai|news7|news18|ndtv|thanthi/.test(n)) return 'News'
  if (/music|isai|hits|songs|musix/.test(n))                          return 'Music'
  if (/movie|cinema|film|flix/.test(n))                               return 'Movies'
  if (/god|sivan|jothi|church|angel|hebron|verbum|madha|nambikkai|sairam|aaseervatham|sangha|religious|divine/.test(n)) return 'Religious'
  if (/kids|junior|nick|hungama|disney/.test(n))                      return 'Kids'
  return 'Entertainment'
}

function applyQualityFilter(list, qf) {
  if (!qf) return list
  if (qf === 'HD') return list.filter((c) => { const b = c.badge?.toUpperCase(); return b === 'HD' || b === '1080P' || b === '720P' })
  return list.filter((c) => c.badge?.toUpperCase() === qf)
}

// ── Shared row/section components ─────────────────────────────────────────────

function SectionRow({ icon, label, count, channels, onSeeAll, expanded, onToggleExpand, gridPage, onLoadMore }) {
  const visible = expanded ? channels.slice(0, gridPage * GRID_PAGE) : channels.slice(0, ROW_LIMIT)
  const hasMore = expanded && visible.length < channels.length

  return (
    <div>
      <div className="flex items-center gap-2 px-4 md:px-6 mb-3">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-white font-bold text-sm">{label}</span>
        <span className="text-[10px] bg-white/[0.07] text-white/40 px-1.5 py-0.5 rounded-full font-semibold">{count}</span>
        {channels.length > ROW_LIMIT && !expanded && (
          <button onClick={onSeeAll ?? onToggleExpand} className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-brand-400 active:text-brand-300">
            See all <ChevronRight size={13} />
          </button>
        )}
        {expanded && (
          <button onClick={onToggleExpand} className="ml-auto text-[12px] font-semibold text-white/30 active:text-white/60">
            Collapse ↑
          </button>
        )}
      </div>

      {!expanded ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-6 pb-1">
          {visible.map((ch, i) => (
            <div key={ch.id} className="flex-shrink-0 w-44">
              <ChannelCard channel={ch} index={i} animated={false} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visible.map((ch, i) => (
              <ChannelCard key={ch.id} channel={ch} index={i} animated={false} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onLoadMore}
              className="mt-4 w-full py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/70 hover:border-white/20 transition-colors"
            >
              Load more ({channels.length - visible.length} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Trending (All tab) — Netflix-style sections ────────────────────────────────

function TrendingSections({ channels, setActiveCategory }) {
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

  const sections = TRENDING_SECTIONS.filter((s) => grouped[s.id]?.length)

  const toggle = (id) => {
    if (expanded === id) { setExpanded(null) }
    else { setExpanded(id); setGridPage(1) }
  }

  if (!sections.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">📺</div>
      <p className="text-white/50 text-lg font-medium">No channels available</p>
    </div>
  )

  return (
    <div className="pb-6 space-y-7">
      {sections.map((sec) => (
        <SectionRow
          key={sec.id}
          icon={sec.icon}
          label={sec.label}
          count={grouped[sec.id].length}
          channels={grouped[sec.id]}
          onSeeAll={() => setActiveCategory(sec.id)}
          expanded={expanded === sec.id}
          onToggleExpand={() => toggle(sec.id)}
          gridPage={gridPage}
          onLoadMore={() => setGridPage((p) => p + 1)}
        />
      ))}
    </div>
  )
}

// ── Grouped sections for IPTV Sports & Tamil ──────────────────────────────────

function GroupedSections({ channels, inferFn, sectionOrder }) {
  const [expanded, setExpanded] = useState(null)
  const [gridPage, setGridPage] = useState(1)

  const { grouped, order } = useMemo(() => {
    const map = {}
    for (const ch of channels) {
      const group = inferFn(ch.name)
      if (!map[group]) map[group] = []
      map[group].push(ch)
    }
    const knownOrder = sectionOrder.filter((g) => map[g])
    const rest = Object.keys(map).filter((g) => !sectionOrder.includes(g)).sort()
    return { grouped: map, order: [...knownOrder, ...rest] }
  }, [channels, inferFn, sectionOrder])

  const toggle = (id) => {
    if (expanded === id) { setExpanded(null) }
    else { setExpanded(id); setGridPage(1) }
  }

  if (!order.length) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">📺</div>
      <p className="text-white/50 text-lg font-medium">No channels available</p>
    </div>
  )

  return (
    <div className="pb-6 space-y-7">
      {order.map((group) => (
        <SectionRow
          key={group}
          icon={null}
          label={group}
          count={grouped[group].length}
          channels={grouped[group]}
          expanded={expanded === group}
          onToggleExpand={() => toggle(group)}
          gridPage={gridPage}
          onLoadMore={() => setGridPage((p) => p + 1)}
        />
      ))}
    </div>
  )
}

const IPTV_SPORT_ORDER = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Golf', 'Racing', 'Combat Sports', 'Hockey', 'Rugby', 'Motorsport', 'General Sports']
const TAMIL_TYPE_ORDER = ['Entertainment', 'News', 'Music', 'Movies', 'Religious', 'Kids']

// ── TpGroupedView ─────────────────────────────────────────────────────────────

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

  const toggle = (id) => {
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
    <div className="pb-6 space-y-7">
      {sections.map((sec) => (
        <SectionRow
          key={sec.id}
          icon={sec.icon}
          label={sec.label}
          count={grouped[sec.id].length}
          channels={grouped[sec.id]}
          expanded={expanded === sec.id}
          onToggleExpand={() => toggle(sec.id)}
          gridPage={gridPage}
          onLoadMore={() => setGridPage((p) => p + 1)}
        />
      ))}
    </div>
  )
}

// ── Home page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { activeCategory, setActiveCategory, searchQuery, channels, channelsLoading, favorites } = useStore()
  const { containerRef, pullY, refreshing, threshold } = usePullToRefresh(() => window.location.reload())
  const [qualityFilter, setQualityFilter] = useState(null)

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
    if (activeCategory === 'fifa2026') {
      list = list
        .map((ch) => ({ ...ch, status: fifaStatusOf(ch.key) }))
        .sort((a, b) => FIFA_SORT_WEIGHT[a.status] - FIFA_SORT_WEIGHT[b.status])
    }
    list = applyQualityFilter(list, qualityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.currentMatch?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      )
    }
    return list
  }, [activeCategory, searchQuery, channels, qualityFilter])

  const { visible, hasMore, sentinelRef } = usePagedList(filtered, containerRef)
  const animated = filtered.length <= 40

  const showTpGrouped     = activeCategory === 'tataplay'   && !searchQuery.trim() && !qualityFilter
  const showTrending      = activeCategory === 'all'        && !searchQuery.trim() && !qualityFilter
  const showIptvSections  = activeCategory === 'iptvsports' && !searchQuery.trim() && !qualityFilter
  const showTamilSections = activeCategory === 'tamil'      && !searchQuery.trim() && !qualityFilter

  return (
    <main ref={containerRef} className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      <PullIndicator pullY={pullY} refreshing={refreshing} threshold={threshold} />

      <HeroSection />

      <div className="px-4 md:px-6 pt-5 pb-3">
        <CategoryTabs />
      </div>

      {/* Quality filter strip */}
      {(() => {
        // Compute counts from the pre-quality-filtered list (category + search already applied)
        const preQuality = (() => {
          let list = channels
          if (activeCategory === 'fancode')       list = list.filter((c) => c.key?.startsWith('fc_'))
          else if (activeCategory === 'sonyliv')  list = list.filter((c) => c.key?.startsWith('sl_'))
          else if (activeCategory === 'tataplay') list = list.filter((c) => c.key?.startsWith('tp_'))
          else if (activeCategory !== 'all')      list = list.filter((c) => c.category === activeCategory)
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter((c) => c.name?.toLowerCase().includes(q) || c.currentMatch?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q))
          }
          return list
        })()
        const qCounts = {
          null: preQuality.length,
          HD: preQuality.filter((c) => { const b = c.badge?.toUpperCase(); return b === 'HD' || b === '1080P' || b === '720P' }).length,
          '4K': preQuality.filter((c) => c.badge?.toUpperCase() === '4K').length,
          '2K': preQuality.filter((c) => c.badge?.toUpperCase() === '2K').length,
        }
        return (
          <div className="flex items-center gap-2 px-4 md:px-6 pb-3">
            <span className="text-white/25 text-[11px] font-semibold uppercase tracking-widest flex-shrink-0">Quality</span>
            <div className="flex gap-1.5">
              {QUALITY_FILTERS.map(({ label, value }) => {
                const cnt = qCounts[value]
                return (
                  <button
                    key={label}
                    onClick={() => setQualityFilter(value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      qualityFilter === value
                        ? 'bg-brand-500 border-brand-500 text-black'
                        : cnt === 0
                        ? 'bg-white/[0.02] border-white/[0.04] text-white/20 cursor-default'
                        : 'bg-white/[0.05] border-white/[0.08] text-white/40 hover:text-white hover:border-white/20'
                    }`}
                    disabled={cnt === 0 && value !== null}
                  >
                    {label}
                    {value !== null && cnt > 0 && (
                      <span className={`ml-1 text-[9px] font-black ${qualityFilter === value ? 'text-black/60' : 'text-white/25'}`}>
                        {cnt}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {qualityFilter && (
              <span className="ml-auto text-white/30 text-xs">
                {filtered.length} channel{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )
      })()}

      {/* Favourites row */}
      {favoriteChannels.length > 0 && activeCategory === 'all' && !searchQuery.trim() && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="pb-3">
          <div className="flex items-center gap-2 px-4 md:px-6 mb-2.5">
            <Heart size={13} className="text-red-400 fill-red-400" />
            <span className="text-white font-bold text-sm">Favourites</span>
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
              {favoriteChannels.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-6 pb-1">
            {favoriteChannels.map((ch, i) => (
              <div key={ch.id} className="flex-shrink-0 w-44">
                <ChannelCard channel={ch} index={i} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Section views ── */}
      {showTpGrouped ? (
        channelsLoading && tpChannels.length === 0 ? (
          <SkeletonRows />
        ) : (
          <TpGroupedView channels={tpChannels} />
        )
      ) : showTrending ? (
        channelsLoading && channels.length <= 2 ? (
          <SkeletonRows />
        ) : (
          <TrendingSections channels={filtered.length ? filtered : channels} setActiveCategory={setActiveCategory} />
        )
      ) : showIptvSections ? (
        <GroupedSections channels={filtered} inferFn={inferIptvSport} sectionOrder={IPTV_SPORT_ORDER} />
      ) : showTamilSections ? (
        <GroupedSections channels={filtered} inferFn={inferTamilType} sectionOrder={TAMIL_TYPE_ORDER} />
      ) : (
        /* Flat grid for specific category / search / quality filter */
        <div className="px-4 md:px-6 pb-6">
          {channelsLoading && channels.length <= 2 ? (
            <SkeletonGrid />
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

// ── Skeleton loaders ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-44 rounded-2xl bg-[#141414] border border-white/[0.05] overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#1e1e1e]" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[#222] rounded w-full" />
        <div className="h-3 bg-[#222] rounded w-2/3" />
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="pb-6 space-y-7">
      {[1, 2, 3].map((s) => (
        <div key={s}>
          <div className="h-4 w-36 bg-white/[0.07] rounded mb-3 mx-4 animate-pulse" />
          <div className="flex gap-3 px-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonGrid() {
  return (
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
  )
}
