import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Tv2, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Link, useNavigate } from 'react-router-dom'

export default function Header() {
  const { searchQuery, setSearchQuery, refreshChannels, hardRefresh, channelsLoading } = useStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    navigate('/')
  }

  // Tap = soft refresh, long-press (≥600ms) = hard refresh (clear cache + reload).
  const longPressRef = useRef(false)
  const timerRef = useRef(null)
  const [holding, setHolding] = useState(false)

  const startPress = () => {
    longPressRef.current = false
    setHolding(true)
    timerRef.current = setTimeout(() => {
      longPressRef.current = true
      setHolding(false)
      navigator.vibrate?.(20)
      hardRefresh()
    }, 600)
  }

  const endPress = () => {
    clearTimeout(timerRef.current)
    setHolding(false)
    if (!longPressRef.current) refreshChannels()
  }

  const cancelPress = () => {
    clearTimeout(timerRef.current)
    setHolding(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-white/[0.06]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="h-14 flex items-center px-4 gap-3">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg">
            <Tv2 size={16} className="text-black" />
          </div>
          <div className="flex items-baseline gap-0">
            <span className="font-black text-lg tracking-tight text-white" style={{ fontFamily: 'Oswald, sans-serif' }}>
              CRIC
            </span>
            <span className="font-black text-lg tracking-tight" style={{ fontFamily: 'Oswald, sans-serif', color: '#c8ff00' }}>
              FUSION
            </span>
          </div>
        </Link>

        {/* Desktop search bar */}
        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-md ml-4">
          <div className="relative flex items-center w-full rounded-xl border border-white/[0.08] bg-white/[0.06]">
            <Search size={15} className="absolute left-3 text-white/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels, sports…"
              className="w-full bg-transparent text-sm py-2 pl-9 pr-9 outline-none text-white placeholder-white/30"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-white/40 hover:text-white">
                  <X size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </form>

        <div className="flex-1" />

        {/* Refresh — tap = soft re-pull, long-press = hard refresh (clear cache + reload) */}
        <motion.button title="Tap to refresh · hold to hard refresh"
          animate={{ scale: holding ? 0.82 : 1 }}
          transition={{ type: 'tween', duration: holding ? 0.6 : 0.15, ease: 'easeOut' }}
          onPointerDown={startPress} onPointerUp={endPress}
          onPointerLeave={cancelPress} onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none' }}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <RefreshCw size={16} className={channelsLoading ? 'animate-spin text-brand-500' : ''} />
        </motion.button>

        {/* Mobile search toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSearchOpen((v) => !v)}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          {searchOpen ? <X size={20} /> : <Search size={20} />}
        </motion.button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-black text-xs font-black cursor-pointer">
          CF
        </div>
      </div>

      {/* Mobile search dropdown */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="sm:hidden border-t border-white/[0.06] px-4 py-3 bg-black"
          >
            <form onSubmit={(e) => { handleSearch(e); setSearchOpen(false) }}>
              <div className="relative flex items-center rounded-xl border border-white/[0.08] bg-white/[0.06]">
                <Search size={15} className="absolute left-3 text-white/40" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); navigate('/') }}
                  placeholder="Search channels, sports…"
                  className="w-full bg-transparent text-sm py-2.5 pl-9 pr-4 outline-none text-white placeholder-white/30"
                  autoFocus
                />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
