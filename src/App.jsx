import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff, Wifi, X, RefreshCw } from 'lucide-react'
import { useStore } from './store/useStore'
import { fetchSiteStatus } from './utils/site-status'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import Home from './pages/Home'
import Search from './pages/Search'
import Sports from './pages/Sports'
import Account from './pages/Account'
import Watch from './pages/Watch'
import MultiView from './pages/MultiView'
import OwnerRef from './pages/OwnerRef'
import { FEATURES } from './config/features'

// Inner component so useLocation works inside BrowserRouter
function AppContent() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-dvh bg-black text-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex flex-1 w-full overflow-hidden"
          >
            <Routes location={location}>
              <Route path="/"         element={<Home />} />
              <Route path="/search"   element={<Search />} />
              <Route path="/sports"   element={<Sports />} />
              <Route path="/account"  element={<Account />} />
              <Route path="/watch/:id"   element={<Watch />} />
              {FEATURES.MULTIVIEW && <Route path="/multiview" element={<MultiView />} />}
              <Route path="/cf-owner" element={<OwnerRef />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { darkMode, loadChannels, refreshChannels } = useStore()
  const [isOnline, setIsOnline]           = useState(navigator.onLine)
  const [offlineDismissed, setDismissed]  = useState(false)
  const [showOnlineToast, setOnlineToast] = useState(false)
  const [maintenance, setMaintenance]     = useState(false)
  const [maintMessage, setMaintMessage]   = useState('')

  // Poll Gist for site-wide maintenance status
  useEffect(() => {
    async function check() {
      const s = await fetchSiteStatus()
      if (s) { setMaintenance(s.down); setMaintMessage(s.message || '') }
    }
    check()
    const interval = setInterval(check, 5 * 60 * 1000) // re-check every 5 min
    // Also re-check immediately when owner fires the console command
    const handler = () => check()
    window.addEventListener('cf_maintenance_change', handler)
    return () => { clearInterval(interval); window.removeEventListener('cf_maintenance_change', handler) }
  }, [])

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('dark', darkMode)
    html.style.colorScheme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    async function boot() {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready
          if (!navigator.serviceWorker.controller) {
            await Promise.race([
              new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })),
              new Promise(r => setTimeout(r, 800)),
            ])
          }
        } catch {}
      }
      loadChannels()
    }
    boot()
  }, [])

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      setOnlineToast(true)
      refreshChannels()
      setTimeout(() => setOnlineToast(false), 3000)
    }
    const goOffline = () => { setIsOnline(false); setDismissed(false) }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>

      {/* ── Maintenance overlay ── */}
      <AnimatePresence>
        {maintenance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-8 text-center"
            style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f1a0a 0%, #050505 70%)' }}
          >
            {/* Animated ring */}
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                className="w-28 h-28 rounded-full border-2 border-dashed border-brand-500/20 absolute inset-0"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                className="w-20 h-20 rounded-full border border-dashed border-brand-500/30 absolute inset-0 m-4"
              />
              <div className="w-28 h-28 rounded-full bg-dark-800 border border-brand-500/20 flex items-center justify-center">
                <span className="text-4xl">🔧</span>
              </div>
            </div>

            {/* Logo */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
                <span className="text-black font-black text-xs">CF</span>
              </div>
              <span className="text-white font-black text-lg tracking-tight">CricFusion</span>
            </div>

            <h1 className="text-white font-black text-2xl md:text-3xl mb-3 tracking-tight">
              Under Maintenance
            </h1>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs mb-8">
              {maintMessage || "We're making things better for you. Be back shortly."}
            </p>

            {/* Pulsing status */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-2 h-2 bg-yellow-400 rounded-full"
              />
              <span className="text-yellow-400 text-xs font-bold tracking-wider uppercase">Maintenance in progress</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Offline overlay ── */}
      <AnimatePresence>
        {!isOnline && !offlineDismissed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] bg-dark-900/95 backdrop-blur-sm flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Close button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setDismissed(true)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center"
            >
              <X size={16} className="text-white/50" />
            </motion.button>

            <motion.div
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-3xl bg-dark-700 flex items-center justify-center mb-6 border border-white/[0.07]"
            >
              <WifiOff size={36} className="text-white/30" />
            </motion.div>
            <h2 className="text-white font-bold text-xl mb-2">No Connection</h2>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Check your internet. Streams will resume automatically when you're back online.
            </p>

            <div className="flex items-center gap-3 mt-8">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-sm font-semibold">Offline</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => refreshChannels()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white/60 text-sm font-semibold hover:text-white transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Back-online toast ── */}
      <AnimatePresence>
        {showOnlineToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-20 inset-x-0 z-[200] flex justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-brand-500 text-black px-4 py-2 rounded-full font-bold text-sm shadow-xl">
              <Wifi size={14} />
              Back online
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
