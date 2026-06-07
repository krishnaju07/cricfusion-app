import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Trophy, UserCircle } from 'lucide-react'

const TABS = [
  { id: 'home',    label: 'Home',       icon: Home,       path: '/' },
  { id: 'search',  label: 'Search',     icon: Search,     path: '/search' },
  { id: 'sports',  label: 'All Sports', icon: Trophy,     path: '/sports' },
  { id: 'account', label: 'Account',    icon: UserCircle, path: '/account' },
]

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black"
      style={{
        boxShadow: '0 -1px 0 rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Indicator pill — always rendered, opacity drives transition */}
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                style={{
                  width: 28,
                  height: 3,
                  background: '#c8ff00',
                  opacity: active ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
              />

              <tab.icon
                size={22}
                strokeWidth={active ? 2.5 : 1.5}
                style={{
                  color: active ? '#c8ff00' : 'rgba(255,255,255,0.35)',
                  transition: 'color 0.2s ease, stroke-width 0.2s ease',
                }}
              />
              <span
                className="text-[10px] font-semibold"
                style={{
                  color: active ? '#c8ff00' : 'rgba(255,255,255,0.35)',
                  transition: 'color 0.2s ease',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
