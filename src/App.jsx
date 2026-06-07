import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore'
import Header from './components/Layout/Header'
import BottomNav from './components/Layout/BottomNav'
import Home from './pages/Home'
import Search from './pages/Search'
import Sports from './pages/Sports'
import Account from './pages/Account'
import Watch from './pages/Watch'

// Inner component so useLocation works inside BrowserRouter
function AppContent() {
  const location = useLocation()

  return (
    <div className="flex flex-col min-h-dvh bg-black text-white">
      <Header />
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100dvh - 56px)' }}>
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
              <Route path="/watch/:id" element={<Watch />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { darkMode, loadChannels } = useStore()

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

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
