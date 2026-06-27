import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { Users, Search, X, ChevronDown, ChevronRight } from 'lucide-react'

const SPORT_CATS = [
  { id: 'all',        label: 'All',      icon: '🔥' },
  { id: 'fifa2026',   label: 'FIFA',     icon: '🏆' },
  { id: 'starsony',   label: 'Star/Sony',icon: '⭐' },
  { id: 'cricket',    label: 'Cricket',  icon: '🏏' },
  { id: 'football',   label: 'Football', icon: '⚽' },
  { id: 'tennis',     label: 'Tennis',   icon: '🎾' },
  { id: 'basketball', label: 'NBA',      icon: '🏀' },
  { id: 'formula1',   label: 'F1',       icon: '🏎️' },
  { id: 'boxing',     label: 'Boxing',   icon: '🥊' },
  { id: 'iptvsports', label: 'IPTV',     icon: '📡' },
  { id: 'tamil',      label: 'Tamil',    icon: '🎬' },
  { id: 'multi',      label: 'Multi',    icon: '🎯' },
]

// order for "All" grouped view
const GROUP_ORDER = ['fifa2026','starsony','cricket','football','tennis','basketball','formula1','boxing','multi','iptvsports','tamil']
const GROUP_META  = Object.fromEntries(SPORT_CATS.map((c) => [c.id, c]))

const VPN_FLAG = { DE: '🇩🇪', AT: '🇦🇹', BE: '🇧🇪', SK: '🇸🇰', CZ: '🇨🇿', FR: '🇫🇷', IE: '🇮🇪', CA: '🇨🇦', SA: '🇸🇦' }
const VPN_NAME = { DE: 'Germany', AT: 'Austria', BE: 'Belgium', SK: 'Slovakia', CZ: 'Czech Republic', FR: 'France', IE: 'Ireland', CA: 'Canada', SA: 'Saudi Arabia' }

// ── Channel row ───────────────────────────────────────────────────────────────
function ChannelRow({ ch, isActive, isSameCat, activeRef, onClick }) {
  return (
    <motion.button
      ref={isActive ? activeRef : null}
      data-active={isActive ? 'true' : undefined}
      whileHover={{ x: 3 }}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all ${
        isActive
          ? 'bg-brand-500/20 border border-brand-500/30'
          : isSameCat
          ? 'hover:bg-white/[0.06] border border-transparent hover:border-white/[0.05]'
          : 'hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      {/* Logo */}
      <div className={`w-10 h-7 rounded overflow-hidden flex-shrink-0 relative ${isActive ? 'ring-1 ring-brand-500/50' : ''}`}>
        {ch.logoUrl
          ? <img src={ch.logoUrl} alt="" className="w-full h-full object-contain bg-dark-700 p-0.5"
              onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling?.classList.remove('hidden') }} />
          : null}
        <div className={`${ch.logoUrl ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-[9px] font-black ${
          isActive ? 'gradient-brand text-white' : 'bg-dark-600 text-white/70'
        }`}>
          {ch.logo}
        </div>
      </div>

      <div className="flex-1 min-w-0 text-left">
        <p className={`text-[11px] font-semibold truncate leading-tight ${isActive ? 'text-brand-400' : 'text-white/80'}`}>
          {ch.name}
        </p>
        <p className="text-white/30 text-[9px] truncate mt-0.5">
          {ch.currentMatch || ch.category}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isActive ? 'bg-brand-500' : 'bg-red-500'}`} />
        {ch.viewers && ch.viewers !== '—' && (
          <div className="flex items-center gap-0.5 text-white/20 text-[9px]">
            <Users size={7} /><span>{ch.viewers}</span>
          </div>
        )}
        {ch.badge === '4K' && (
          <span className="text-[7px] font-black px-1 py-px rounded bg-purple-600/70 text-white">4K</span>
        )}
        {ch.vpn && VPN_FLAG[ch.vpn] && (
          <span title={`${VPN_NAME[ch.vpn] || ch.vpn} VPN required`} className="text-[10px] leading-none">
            {VPN_FLAG[ch.vpn]}
          </span>
        )}
      </div>
    </motion.button>
  )
}

// ── Collapsible group section ─────────────────────────────────────────────────
function GroupSection({ cat, channels, currentChannelId, activeRef, navigate, defaultOpen }) {
  const hasActive = channels.some((c) => c.id === currentChannelId)
  // `null` = follow default; once the user toggles, honour their choice.
  const [userOpen, setUserOpen] = useState(null)
  // The group holding the active channel stays open so its row is in the DOM
  // and can be centered when the selection changes.
  const open = hasActive ? true : (userOpen ?? defaultOpen)
  const setOpen = (fn) => setUserOpen((prev) => (typeof fn === 'function' ? fn(prev ?? defaultOpen) : fn))
  const meta = GROUP_META[cat] ?? { label: cat, icon: '📺' }

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors group"
      >
        <span className="text-sm leading-none">{meta.icon}</span>
        <span className="flex-1 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">
          {meta.label}
        </span>
        <span className="text-[9px] bg-white/[0.07] text-white/30 px-1.5 py-0.5 rounded-full font-semibold mr-1">
          {channels.length}
        </span>
        {open
          ? <ChevronDown size={11} className="text-white/25" />
          : <ChevronRight size={11} className="text-white/25" />
        }
      </button>

      {/* Channels */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden px-1"
          >
            {channels.map((ch) => (
              <ChannelRow
                key={ch.id}
                ch={ch}
                isActive={ch.id === currentChannelId}
                isSameCat={false}
                activeRef={activeRef}
                onClick={() => navigate(`/watch/${ch.id}`)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-px bg-white/[0.04] mx-3 mt-1" />
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar({ currentChannelId }) {
  const { isSidebarOpen, channels } = useStore()
  const navigate  = useNavigate()
  const activeRef = useRef(null)
  const listRef   = useRef(null)
  const [query, setQuery]       = useState('')
  const [catFilter, setCatFilter] = useState('all')

  const currentChannel = useMemo(
    () => channels.find((c) => c.id === currentChannelId),
    [channels, currentChannelId]
  )

  const liveChannels = useMemo(() => {
    let list = channels.filter((c) => c.isLive)
    if (catFilter !== 'all') list = list.filter((c) => c.category === catFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((c) => c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q))
    }
    return list
  }, [channels, catFilter, query])

  // grouped for "All" view (no search)
  const grouped = useMemo(() => {
    if (catFilter !== 'all' || query.trim()) return null
    const map = {}
    for (const ch of liveChannels) {
      const cat = ch.category || 'multi'
      if (!map[cat]) map[cat] = []
      map[cat].push(ch)
    }
    return map
  }, [liveChannels, catFilter, query])

  const groupOrder = useMemo(() => {
    if (!grouped) return []
    const known = GROUP_ORDER.filter((g) => grouped[g])
    const rest  = Object.keys(grouped).filter((g) => !GROUP_ORDER.includes(g)).sort()
    return [...known, ...rest]
  }, [grouped])

  useEffect(() => {
    const parent = listRef.current
    if (!parent) return

    const center = (smooth) => {
      const el = parent.querySelector('[data-active="true"]')
      if (!el) return false
      // Scroll ONLY the sidebar's own list (never scrollIntoView, which also
      // scrolls the page). Pin the active row to the vertical center so the
      // next channel is always one click away without scrolling.
      const eTop = el.getBoundingClientRect().top
      const pTop = parent.getBoundingClientRect().top
      const target = parent.scrollTop + (eTop - pTop) - (parent.clientHeight - el.offsetHeight) / 2
      const clamped = Math.max(0, Math.min(target, parent.scrollHeight - parent.clientHeight))
      parent.scrollTo({ top: clamped, behavior: smooth ? 'smooth' : 'auto' })
      return true
    }

    // The grouped "All" view expands sections with a ~0.2s Framer Motion height
    // animation, so the active row keeps shifting after the route changes.
    // Re-center across a few frames until the layout settles, then once more
    // after the animation completes.
    let frames = 0
    let raf
    const tick = () => {
      center(false)
      if (++frames < 12) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const t = setTimeout(() => center(true), 280)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [currentChannelId, grouped, catFilter, query])

  const totalLive = channels.filter((c) => c.isLive).length

  return (
    <AnimatePresence>
      {isSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="hidden md:flex flex-col h-full glass-dark border-r border-white/[0.06] overflow-hidden flex-shrink-0"
        >
          {/* ── Header ── */}
          <div className="px-3 pt-3 pb-2.5 border-b border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Live Now</p>
              <span className="flex items-center gap-1 text-[10px] bg-red-600/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-bold">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {totalLive}
              </span>
            </div>

            {/* Search */}
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-white/30 flex-shrink-0 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels…"
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl text-xs text-white placeholder-white/25 py-2 pl-7 pr-7 outline-none focus:border-brand-500/40 transition-colors"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2.5 text-white/30 hover:text-white/60">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sport icon grid */}
            <div className="grid grid-cols-4 gap-1">
              {SPORT_CATS.map((cat) => {
                const active = catFilter === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCatFilter(cat.id)}
                    className={`relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl border text-center transition-all ${
                      active
                        ? 'bg-brand-500/15 border-brand-500/40'
                        : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="text-base leading-none">{cat.icon}</span>
                    <span className={`text-[8px] font-bold leading-none ${active ? 'text-brand-400' : 'text-white/35'}`}>
                      {cat.label}
                    </span>
                    {active && (
                      <motion.div
                        layoutId="cat-indicator"
                        className="absolute inset-0 rounded-xl ring-1 ring-brand-500/50"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Channel list ── */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {liveChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <span className="text-3xl mb-3">📺</span>
                <p className="text-white/25 text-xs">No channels match</p>
                <button
                  onClick={() => { setQuery(''); setCatFilter('all') }}
                  className="mt-2 text-brand-400 text-xs"
                >
                  Clear filters
                </button>
              </div>
            ) : grouped ? (
              /* Grouped collapsible sections */
              <div className="pt-1">
                {groupOrder.map((cat) => (
                  <GroupSection
                    key={cat}
                    cat={cat}
                    channels={grouped[cat]}
                    currentChannelId={currentChannelId}
                    activeRef={activeRef}
                    navigate={navigate}
                    defaultOpen={cat === currentChannel?.category || cat === 'fifa2026' || cat === 'cricket'}
                  />
                ))}
              </div>
            ) : (
              /* Flat filtered list */
              <div className="py-1.5 px-1 space-y-0.5">
                {liveChannels.map((ch) => (
                  <ChannelRow
                    key={ch.id}
                    ch={ch}
                    isActive={ch.id === currentChannelId}
                    isSameCat={currentChannel && ch.category === currentChannel.category}
                    activeRef={activeRef}
                    onClick={() => navigate(`/watch/${ch.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-white/20 text-[10px]">
              {catFilter === 'all' && !query ? `${totalLive} live` : `${liveChannels.length} of ${totalLive}`}
            </span>
            {(query || catFilter !== 'all') && (
              <button
                onClick={() => { setQuery(''); setCatFilter('all') }}
                className="text-[10px] text-brand-400/60 hover:text-brand-400 transition-colors"
              >
                Reset ×
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
