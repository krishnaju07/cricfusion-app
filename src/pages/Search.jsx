import { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search as SearchIcon, X, SlidersHorizontal, LayoutGrid, Layers } from 'lucide-react'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Arabic', 'Spanish', 'French', 'German', 'Portuguese']
const QUALITIES  = ['HD', '4K', '2K']

const CAT_META = {
  cricket:    { label: 'Cricket',     icon: '🏏' },
  football:   { label: 'Football',    icon: '⚽' },
  tennis:     { label: 'Tennis',      icon: '🎾' },
  basketball: { label: 'Basketball',  icon: '🏀' },
  formula1:   { label: 'Formula 1',   icon: '🏎️' },
  boxing:     { label: 'Boxing',      icon: '🥊' },
  multi:      { label: 'Multi Sports',icon: '🎯' },
  fifa2026:   { label: 'FIFA 2026',   icon: '🏆' },
  wc2026live: { label: 'WC Live',     icon: '⚽' },
  iptvsports: { label: 'IPTV Sports', icon: '📡' },
  tamil:      { label: 'Tamil',       icon: '🎬' },
  playlist:   { label: 'Playlist',    icon: '📋' },
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? 'bg-brand-500 border-brand-500 text-black'
          : 'bg-white/[0.05] border-white/[0.10] text-white/50 hover:text-white hover:border-white/20'
      }`}
    >
      {label}
    </button>
  )
}

function SectionHeader({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span className="text-white font-bold text-sm">{label}</span>
      <span className="text-[10px] bg-white/[0.07] text-white/40 px-1.5 py-0.5 rounded-full font-semibold">
        {count}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )
}

export default function Search() {
  const { channels, searchQuery, setSearchQuery } = useStore()
  const inputRef = useRef(null)
  const [activeLang, setActiveLang]   = useState(null)
  const [activeQuality, setActiveQuality] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [groupByCategory, setGroupByCategory] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const hasQuery   = searchQuery.trim().length > 0
  const hasFilters = activeLang || activeQuality

  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = channels

    if (q) {
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.currentMatch?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.language?.toLowerCase().includes(q)
      )
    }

    if (activeLang) {
      list = list.filter((c) => c.language?.toLowerCase() === activeLang.toLowerCase())
    }

    if (activeQuality) {
      if (activeQuality === 'HD') {
        list = list.filter((c) => {
          const b = c.badge?.toUpperCase()
          return b === 'HD' || b === '1080P' || b === '720P'
        })
      } else {
        list = list.filter((c) => c.badge?.toUpperCase() === activeQuality)
      }
    }

    if (!q && !hasFilters) return []
    return list
  }, [searchQuery, channels, activeLang, activeQuality, hasFilters])

  // Group results by category for the grouped view
  const grouped = useMemo(() => {
    if (!groupByCategory || !results.length) return null
    const map = {}
    for (const ch of results) {
      const cat = ch.category || 'multi'
      if (!map[cat]) map[cat] = []
      map[cat].push(ch)
    }
    // Sort groups by size (largest first)
    const order = Object.keys(map).sort((a, b) => map[b].length - map[a].length)
    return { map, order }
  }, [results, groupByCategory])

  const toggleLang    = (lang) => setActiveLang((prev) => (prev === lang ? null : lang))
  const toggleQuality = (q)    => setActiveQuality((prev) => (prev === q ? null : q))

  const clearAll = () => {
    setActiveLang(null)
    setActiveQuality(null)
    setSearchQuery('')
  }

  const activeFilterCount = (activeLang ? 1 : 0) + (activeQuality ? 1 : 0)
  const uniqueCatCount    = results.length ? new Set(results.map((c) => c.category)).size : 0

  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-black px-4 pt-4 pb-3 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex items-center rounded-2xl border border-white/[0.10] bg-white/[0.07] flex-1">
            <SearchIcon size={18} className="absolute left-4 text-white/40 flex-shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches, channels, sports…"
              className="w-full bg-transparent text-base py-3.5 pl-11 pr-10 outline-none text-white placeholder-white/30"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={() => { setSearchQuery(''); inputRef.current?.focus() }}
                  className="absolute right-4 text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Group toggle — only shown when results span 2+ categories */}
          {results.length > 0 && uniqueCatCount > 1 && (
            <button
              onClick={() => setGroupByCategory((v) => !v)}
              title={groupByCategory ? 'Flat grid' : 'Group by sport'}
              className={`flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
                groupByCategory
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                  : 'bg-white/[0.07] border-white/[0.10] text-white/40 hover:text-white'
              }`}
            >
              {groupByCategory ? <Layers size={18} /> : <LayoutGrid size={18} />}
            </button>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
              showFilters || hasFilters
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                : 'bg-white/[0.07] border-white/[0.10] text-white/40 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 rounded-full text-[9px] font-black text-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-2.5"
            >
              <div>
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Language</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  <FilterChip label="All" active={!activeLang} onClick={() => setActiveLang(null)} />
                  {LANGUAGES.map((lang) => (
                    <FilterChip key={lang} label={lang} active={activeLang === lang} onClick={() => toggleLang(lang)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Quality</p>
                <div className="flex gap-2">
                  <FilterChip label="All" active={!activeQuality} onClick={() => setActiveQuality(null)} />
                  {QUALITIES.map((q) => (
                    <FilterChip key={q} label={q} active={activeQuality === q} onClick={() => toggleQuality(q)} />
                  ))}
                </div>
              </div>

              {hasFilters && (
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 font-semibold">
                  Clear all filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Results area ── */}
      <div className="px-4 pt-4">
        {!hasQuery && !hasFilters ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-white/[0.05] flex items-center justify-center mb-5">
              <SearchIcon size={32} className="text-white/20" />
            </div>
            <p className="text-white/50 text-base font-semibold">Find your match</p>
            <p className="text-white/25 text-sm mt-1">Search by sport, team, channel or language</p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {['Cricket', 'Football', 'Tennis', 'F1', 'NBA', 'Tamil'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSearchQuery(s)}
                  className="px-4 py-1.5 rounded-full border border-white/[0.10] text-white/50 text-sm hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

        ) : results.length === 0 ? (
          /* No results */
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="text-4xl mb-4">😕</div>
            <p className="text-white/50 text-base font-semibold">
              No results{searchQuery ? ` for "${searchQuery}"` : ''}
            </p>
            <p className="text-white/25 text-sm mt-1">Try a different keyword or adjust filters</p>
          </motion.div>

        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Result count + active filter chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <p className="text-white/30 text-xs font-semibold uppercase tracking-widest">
                {results.length} result{results.length !== 1 ? 's' : ''}
                {uniqueCatCount > 1 && ` · ${uniqueCatCount} sports`}
              </p>
              {activeLang && (
                <span className="text-[10px] bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {activeLang}
                </span>
              )}
              {activeQuality && (
                <span className="text-[10px] bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {activeQuality}
                </span>
              )}
            </div>

            {/* Grouped view */}
            {grouped ? (
              <div className="pb-6">
                {grouped.order.map((cat) => {
                  const meta  = CAT_META[cat] || { label: cat, icon: '📺' }
                  const items = grouped.map[cat]
                  return (
                    <div key={cat}>
                      <SectionHeader icon={meta.icon} label={meta.label} count={items.length} />
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {items.map((ch, i) => (
                          <ChannelCard key={ch.id} channel={ch} index={i} animated={false} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Flat grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-6">
                {results.map((ch, i) => (
                  <ChannelCard key={ch.id} channel={ch} index={i} animated={results.length <= 40} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </main>
  )
}
