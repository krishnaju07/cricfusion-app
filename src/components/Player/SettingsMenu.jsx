import { motion } from 'framer-motion'
import { Check, Zap, Mic } from 'lucide-react'

export default function SettingsMenu({
  levels, currentQuality, onSelectQuality,
  streamTracks, subtitleMode, onSelectSubtitle,
  onClose,
}) {
  return (
    <>
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-20 right-4 glass-dark rounded-xl overflow-hidden shadow-2xl z-50 min-w-[170px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Quality ── */}
        <div className="px-3 pt-2.5 pb-1.5 border-b border-white/10">
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Video Quality</p>
        </div>
        <div className="py-1 border-b border-white/10">
          {levels.map((level) => (
            <button
              key={level.id}
              onClick={() => onSelectQuality(level.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                {level.label === 'Auto' && <Zap size={12} className="text-brand-400" />}
                <span className="text-white text-sm">{level.label}</span>
              </div>
              {currentQuality === level.label && <Check size={14} className="text-brand-400" />}
            </button>
          ))}
        </div>

        {/* ── Subtitles ── */}
        <div className="px-3 pt-2.5 pb-1.5 border-b border-white/10">
          <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Subtitles</p>
        </div>
        <div className="py-1">
          <button
            onClick={() => onSelectSubtitle(null)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 transition-colors"
          >
            <span className="text-white text-sm">Off</span>
            {subtitleMode === null && <Check size={14} className="text-brand-400" />}
          </button>

          {streamTracks.map((track, i) => (
            <button
              key={i}
              onClick={() => onSelectSubtitle({ type: 'track', index: i })}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 transition-colors"
            >
              <span className="text-white text-sm">
                Subtitle{streamTracks.length > 1 ? ` ${i + 1}` : ''}
              </span>
              {subtitleMode?.type === 'track' && subtitleMode.index === i && (
                <Check size={14} className="text-brand-400" />
              )}
            </button>
          ))}

          <button
            onClick={() => onSelectSubtitle({ type: 'speech' })}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Mic size={12} className="text-brand-400" />
              <span className="text-white text-sm">Live Captions</span>
              <span className="text-[9px] bg-brand-500/25 text-brand-300 px-1 py-0.5 rounded font-bold">BETA</span>
            </div>
            {subtitleMode?.type === 'speech' && <Check size={14} className="text-brand-400" />}
          </button>
        </div>
      </motion.div>
    </>
  )
}
