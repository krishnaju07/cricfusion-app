import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Play, Radio } from 'lucide-react'
import { useStore } from '../../store/useStore'

function MatchTitle({ title }) {
  const parts = title.split(/(\bvs\.?\b)/i)
  return (
    <h1
      className="text-white font-black text-3xl md:text-5xl leading-tight drop-shadow-lg"
      style={{ fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase' }}
    >
      {parts.map((part, i) =>
        /\bvs\.?\b/i.test(part)
          ? <span key={i} style={{ color: '#c8ff00', textShadow: '0 0 24px rgba(200,255,0,0.45)' }}>{part}</span>
          : part
      )}
    </h1>
  )
}

const INTERVAL_MS = 6000

export default function HeroSection() {
  const navigate    = useNavigate()
  const channels    = useStore((s) => s.channels)
  const liveList    = channels.filter((c) => c.isLive).slice(0, 6)
  const [idx, setIdx]         = useState(0)
  const [imgFailed, setImgFailed] = useState(false)
  const [paused, setPaused]   = useState(false)
  const touchStartX = useRef(null)

  const total = liveList.length
  const match = liveList[idx] ?? liveList[0]

  useEffect(() => { setImgFailed(false) }, [idx])

  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total])
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total])

  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(next, INTERVAL_MS)
    return () => clearInterval(t)
  }, [total, next, paused])

  // Swipe on mobile
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 48) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  if (!match) return null

  return (
    <div
      className="relative overflow-hidden bg-black select-none"
      style={{ height: 'clamp(340px, 58vw, 520px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Background: crossfade + Ken Burns zoom ── */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${match.id}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65 }}
        >
          {!imgFailed && match.thumbnail ? (
            <motion.img
              src={match.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1.0 }}
              transition={{ duration: (INTERVAL_MS / 1000) + 1.5, ease: 'linear' }}
            />
          ) : (
            <div className="w-full h-full bg-[#111]" />
          )}

          {/* Layered gradients */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.18) 100%)' }} />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, transparent 62%)' }} />
          {/* Subtle vignette on sides */}
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)' }} />
        </motion.div>
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="absolute inset-0 flex flex-col justify-end px-5 pb-6 md:px-10 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-3 max-w-xl"
          >
            {/* Status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE NOW
              </div>
              {match.viewers && (
                <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-sm text-white/65 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10">
                  <Radio size={9} style={{ color: '#c8ff00' }} />
                  {match.viewers} watching
                </div>
              )}
              {match.badge && (
                <span className="bg-blue-600/80 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-full">
                  {match.badge}
                </span>
              )}
            </div>

            {/* Match title */}
            <MatchTitle title={match.currentMatch} />

            {/* Score / description */}
            {(match.score || match.description) && (
              <p className="text-white/55 text-sm leading-relaxed line-clamp-2">
                {match.score || match.description}
              </p>
            )}

            {/* CTA */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.04, boxShadow: '0 6px 32px rgba(200,255,0,0.5)' }}
              onClick={() => navigate(`/watch/${match.id}`)}
              className="flex items-center gap-2.5 text-black font-bold text-sm px-7 py-3 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #c8ff00 0%, #aadc00 100%)',
                boxShadow: '0 4px 22px rgba(200,255,0,0.38)',
              }}
            >
              <Play size={15} fill="#000" className="text-black flex-shrink-0" />
              Watch Now
            </motion.button>
          </motion.div>
        </AnimatePresence>

        {/* ── Slide indicators with progress fill ── */}
        {total > 1 && (
          <div className="flex items-center gap-2 mt-5">
            {liveList.map((ch, i) => (
              <button
                key={ch.id}
                onClick={() => setIdx(i)}
                className="relative h-[3px] rounded-full overflow-hidden transition-all duration-300"
                style={{
                  width: i === idx ? 40 : 18,
                  background: 'rgba(255,255,255,0.22)',
                }}
              >
                {i === idx && (
                  <motion.div
                    key={`prog-${idx}-${paused}`}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: '#c8ff00' }}
                    initial={{ width: '0%' }}
                    animate={{ width: paused ? '100%' : '100%' }}
                    transition={paused
                      ? { duration: 0 }
                      : { duration: INTERVAL_MS / 1000, ease: 'linear' }
                    }
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop arrow navigation ── */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex w-9 h-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/65 hover:border-white/20 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex w-9 h-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/65 hover:border-white/20 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
