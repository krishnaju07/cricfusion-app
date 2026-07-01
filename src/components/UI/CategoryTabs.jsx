import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { categories } from '../../data/channels'
import { buildCategoryCounts } from '../../constants/channelMeta'

export default function CategoryTabs() {
  const { activeCategory, setActiveCategory, m3uUrl, m3uContent, channels } = useStore()

  const tabs = [
    ...categories,
    ...(m3uUrl || m3uContent ? [{ id: 'playlist', label: 'Playlist', icon: '📋' }] : []),
  ]

  const counts = useMemo(() => buildCategoryCounts(channels), [channels])

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
      {tabs.map((cat) => {
        const active = activeCategory === cat.id
        const count  = counts[cat.id] || 0
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveCategory(cat.id)}
            className="relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap"
            style={{ color: active ? '#000' : 'rgba(255,255,255,0.48)', WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Animated background pill */}
            {active && (
              <motion.div
                layoutId="cat-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: '#c8ff00' }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            )}

            {/* Hover state for inactive */}
            {!active && (
              <motion.div
                className="absolute inset-0 rounded-full bg-white/[0.06]"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              />
            )}

            <span className="relative z-10 flex items-center gap-1.5">
              {cat.icon && <span className="text-sm leading-none">{cat.icon}</span>}
              {cat.label}
              {count > 0 && (
                <span className={`text-[9px] font-black px-1 py-px rounded-full leading-none ${
                  active ? 'bg-black/20 text-black/70' : 'bg-white/[0.10] text-white/35'
                }`}>
                  {count > 999 ? `${Math.floor(count / 1000)}k` : count}
                </span>
              )}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
