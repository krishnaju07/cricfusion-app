import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Zap, Mic, Sparkles, Music2, X,
  PictureInPicture2, ScanLine, ChevronRight, ChevronLeft,
  Subtitles, Settings2,
} from 'lucide-react'

function CastIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
      <line x1="2" y1="20" x2="2.01" y2="20"/>
    </svg>
  )
}

function AirPlayIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>
      <polygon points="12 15 17 21 7 21 12 15"/>
    </svg>
  )
}

const FIT_OPTIONS = ['contain', 'cover', 'fill']
const FIT_LABELS  = { contain: 'Fit', cover: 'Crop', fill: 'Full' }

const slide = {
  enter:  (dir) => ({ x: dir > 0 ?  120 : -120, opacity: 0 }),
  center: ()    => ({ x: 0, opacity: 1 }),
  exit:   (dir) => ({ x: dir > 0 ? -120 :  120, opacity: 0 }),
}

export default function SettingsMenu({
  levels, currentQuality, onSelectQuality,
  audioTracks, audioTrack, onSelectAudio,
  streamTracks, subtitleMode, onSelectSubtitle,
  enhance, onToggleEnhance,
  pipEnabled, pip, onPIP,
  objectFit, onFitChange,
  airPlayAvailable, onAirPlay,
  castAvailable, casting, castPhase, devicesPresent, onCast,
  onClose,
}) {
  const [page, setPage] = useState(null) // null = home
  const [dir,  setDir]  = useState(1)

  const go   = (p) => { setDir(1);  setPage(p) }
  const back = ()  => { setDir(-1); setPage(null) }

  /* ── build top-level items ── */
  const activeQuality  = currentQuality
  const activeAudio    = audioTracks?.find(t => t.id === audioTrack)?.label
  const activeSub      = subtitleMode === null ? 'Off' : subtitleMode?.type === 'speech' ? 'Live' : 'On'
  const activePicture  = [enhance && 'Enhance', FIT_LABELS[objectFit]].filter(Boolean).join(' · ')

  const home = [
    { id: 'quality',   icon: Zap,               label: 'Quality',    hint: activeQuality },
    audioTracks?.length > 1 &&
    { id: 'audio',     icon: Music2,             label: 'Audio',      hint: activeAudio },
    { id: 'subtitles', icon: Subtitles,          label: 'Subtitles',  hint: activeSub },
    { id: 'picture',   icon: Sparkles,           label: 'Picture',    hint: activePicture },
    (pipEnabled || airPlayAvailable || castAvailable) &&
  { id: 'controls',  icon: Settings2,          label: 'Controls' },
  ].filter(Boolean)

  const inner = (
    <AnimatePresence mode="wait" custom={dir}>
      <motion.div
        key={page ?? 'home'}
        custom={dir}
        variants={slide}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      >
        {!page && (
          <div className="py-2">
            {home.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={14} className="text-white/50 flex-shrink-0" />
                  <span className="text-white text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.hint && <span className="text-white/35 text-xs">{item.hint}</span>}
                  <ChevronRight size={13} className="text-white/25" />
                </div>
              </button>
            ))}
          </div>
        )}

        {page === 'quality' && (
          <SubPage title="Quality" onBack={back}>
            {levels.map((level) => (
              <OptionRow
                key={level.id}
                label={level.label}
                icon={level.label === 'Auto' ? Zap : null}
                active={currentQuality === level.label}
                onClick={() => { onSelectQuality(level.id); back() }}
              />
            ))}
          </SubPage>
        )}

        {page === 'audio' && (
          <SubPage title="Audio" onBack={back}>
            {audioTracks.map((track) => (
              <OptionRow
                key={track.id}
                label={track.label}
                active={audioTrack === track.id}
                onClick={() => { onSelectAudio(track.id); back() }}
              />
            ))}
          </SubPage>
        )}

        {page === 'subtitles' && (
          <SubPage title="Subtitles" onBack={back}>
            <OptionRow label="Off" active={subtitleMode === null} onClick={() => { onSelectSubtitle(null); back() }} />
            {streamTracks.map((_, i) => (
              <OptionRow
                key={i}
                label={streamTracks.length > 1 ? `Subtitle ${i + 1}` : 'Subtitle'}
                active={subtitleMode?.type === 'track' && subtitleMode.index === i}
                onClick={() => { onSelectSubtitle({ type: 'track', index: i }); back() }}
              />
            ))}
            <OptionRow
              label="Live Captions"
              badge="BETA"
              icon={Mic}
              active={subtitleMode?.type === 'speech'}
              onClick={() => { onSelectSubtitle({ type: 'speech' }); back() }}
            />
          </SubPage>
        )}

        {page === 'picture' && (
          <SubPage title="Picture" onBack={back}>
            <OptionRow
              label="Enhance"
              badge="SHARP"
              icon={Sparkles}
              active={enhance}
              onClick={onToggleEnhance}
            />
            <div className="px-4 py-3">
              <p className="text-white/40 text-xs mb-2">Aspect Ratio</p>
              <div className="flex gap-2">
                {FIT_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={onFitChange}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      objectFit === f
                        ? 'bg-brand-500/30 text-brand-300 ring-1 ring-brand-500/40'
                        : 'bg-white/8 text-white/50 hover:text-white'
                    }`}
                  >
                    {FIT_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </SubPage>
        )}

        {page === 'controls' && (
          <SubPage title="Controls" onBack={back}>
            {pipEnabled && (
              <OptionRow label="Picture-in-Picture" icon={PictureInPicture2} active={pip} onClick={() => { onPIP(); back() }} />
            )}
            {airPlayAvailable && (
              <button
                onClick={() => { onAirPlay(); back() }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <AirPlayIcon size={14} />
                <span className="text-white text-sm">AirPlay</span>
              </button>
            )}
            {castAvailable && (
              <OptionRow
                label={casting ? 'Stop casting' : castPhase === 'connecting' ? 'Connecting…' : 'Cast to TV'}
                hint={!casting && castPhase !== 'connecting' && !devicesPresent ? 'No TV found' : undefined}
                icon={() => <CastIcon size={14} />}
                active={casting}
                onClick={() => { onCast(); back() }}
              />
            )}
          </SubPage>
        )}
      </motion.div>
    </AnimatePresence>
  )

  return (
    <>
      <div className="absolute inset-0 z-40" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        data-no-gesture
        className="sm:hidden absolute bottom-0 left-0 right-0 z-50 glass-dark rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85%' }}
      >
        <div className="relative flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0 border-b border-white/[0.07]">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-8 h-1 bg-white/20 rounded-full" />
          <span className="text-white font-bold text-sm mt-2">Settings</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center mt-2">
            <X size={14} className="text-white/60" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1" style={{ touchAction: 'pan-y' }}>{inner}</div>
      </motion.div>

      {/* Desktop: dropdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ duration: 0.14 }}
        onClick={(e) => e.stopPropagation()}
        data-no-gesture
        className="hidden sm:block absolute bottom-20 right-4 glass-dark rounded-xl shadow-2xl z-50 w-52 overflow-hidden"
        style={{ maxHeight: 'calc(100% - 120px)' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 0px)' }}>{inner}</div>
      </motion.div>
    </>
  )
}

function SubPage({ title, onBack, children }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 w-full px-4 py-3 text-white/60 hover:text-white transition-colors border-b border-white/[0.07]"
      >
        <ChevronLeft size={15} />
        <span className="text-sm font-semibold">{title}</span>
      </button>
      <div className="py-1">{children}</div>
    </div>
  )
}

function OptionRow({ label, icon: Icon, badge, hint, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon size={13} className={active ? 'text-brand-400 flex-shrink-0' : 'text-white/40 flex-shrink-0'} />}
        <span className={`text-sm truncate ${active ? 'text-white font-medium' : 'text-white/90'}`}>{label}</span>
        {badge && <span className="text-[9px] bg-brand-500/25 text-brand-300 px-1 py-0.5 rounded font-bold flex-shrink-0">{badge}</span>}
      </div>
      {hint && <span className="text-white/35 text-xs flex-shrink-0">{hint}</span>}
      {active && <Check size={14} className="text-brand-400 flex-shrink-0" />}
    </button>
  )
}
