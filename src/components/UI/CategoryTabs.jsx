import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { categories } from '../../data/channels'

export default function CategoryTabs() {
  const { activeCategory, setActiveCategory } = useStore()

  return (
    <div className="flex gap-3 overflow-x-auto pb-0.5 no-scrollbar">
      {categories.map((cat) => {
        const active = activeCategory === cat.id
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.93 }}
            onClick={() => setActiveCategory(cat.id)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap"
            style={{ transition: 'background 0.18s ease, color 0.18s ease' }}
            style={
              active
                ? { background: '#c8ff00', color: '#000' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.55)' }
            }
          >
            {cat.label}
          </motion.button>
        )
      })}
    </div>
  )
}
