import { useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search as SearchIcon, X } from 'lucide-react'
import ChannelCard from '../components/UI/ChannelCard'
import { useStore } from '../store/useStore'

export default function Search() {
  const { channels, searchQuery, setSearchQuery } = useStore()
  const inputRef = useRef(null)

  // Auto-focus search on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.currentMatch.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.language?.toLowerCase().includes(q)
    )
  }, [searchQuery, channels])

  const hasQuery = searchQuery.trim().length > 0

  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-black px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="relative flex items-center rounded-2xl border border-white/[0.10] bg-white/[0.07]">
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
      </div>

      {/* Results */}
      <div className="px-4 pt-4">
        {!hasQuery ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-white/[0.05] flex items-center justify-center mb-5">
              <SearchIcon size={32} className="text-white/20" />
            </div>
            <p className="text-white/50 text-base font-semibold">Find your match</p>
            <p className="text-white/25 text-sm mt-1">Search by sport, team, channel or language</p>

            {/* Quick suggestions */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {['Cricket', 'Football', 'Tennis', 'F1', 'NBA'].map((s) => (
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="text-4xl mb-4">😕</div>
            <p className="text-white/50 text-base font-semibold">No results for "{searchQuery}"</p>
            <p className="text-white/25 text-sm mt-1">Try a different keyword</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {results.map((ch, i) => (
                <ChannelCard key={ch.id} channel={ch} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
