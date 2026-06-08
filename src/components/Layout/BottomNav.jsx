import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, Trophy, UserCircle } from 'lucide-react'

const TABS = [
  { id: 'home',    label: 'Home',       icon: Home,        path: '/' },
  { id: 'search',  label: 'Search',     icon: Search,      path: '/search' },
  { id: 'sports',  label: 'Sports',     icon: Trophy,      path: '/sports' },
  { id: 'account', label: 'Account',    icon: UserCircle,  path: '/account' },
]

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const active = isActive(tab.path)
          return (
            <motion.button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              whileTap={{ scale: 0.88 }}
            >
              {/* Sliding top indicator — wrapper flex-centers so layoutId has no transform conflict */}
              <div className="absolute top-0 left-0 right-0 flex justify-center">
                {active && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="rounded-b-full"
                    style={{ width: 28, height: 3, background: '#c8ff00' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
              </div>

              {/* Icon with spring bounce */}
              <motion.div
                animate={{
                  y: active ? -1 : 0,
                  scale: active ? 1.08 : 1,
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                <tab.icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.5}
                  style={{ color: active ? '#c8ff00' : 'rgba(255,255,255,0.32)' }}
                />
              </motion.div>

              {/* Label */}
              <motion.span
                animate={{ opacity: active ? 1 : 0.45 }}
                transition={{ duration: 0.18 }}
                className="text-[10px] font-semibold"
                style={{ color: active ? '#c8ff00' : 'rgba(255,255,255,0.35)' }}
              >
                {tab.label}
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
