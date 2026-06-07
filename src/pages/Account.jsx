import { motion } from 'framer-motion'
import { Sun, Moon, RefreshCw, Tv2, Bell, Shield, Info, ChevronRight, LogOut, Heart } from 'lucide-react'
import { useStore } from '../store/useStore'

function Row({ icon: Icon, label, value, onClick, accent }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        accent === 'lime'  ? 'bg-brand-500/15' :
        accent === 'red'   ? 'bg-red-500/15' :
        accent === 'blue'  ? 'bg-blue-500/15' :
        accent === 'purple'? 'bg-purple-500/15' :
        'bg-white/[0.06]'
      }`}>
        <Icon size={18} className={
          accent === 'lime'  ? 'text-brand-500' :
          accent === 'red'   ? 'text-red-400' :
          accent === 'blue'  ? 'text-blue-400' :
          accent === 'purple'? 'text-purple-400' :
          'text-white/50'
        } />
      </div>
      <span className="flex-1 text-white text-sm font-medium text-left">{label}</span>
      {value !== undefined
        ? <span className="text-white/40 text-sm">{value}</span>
        : <ChevronRight size={16} className="text-white/25 flex-shrink-0" />
      }
    </motion.button>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="px-4 pb-1.5 text-white/30 text-[11px] font-semibold uppercase tracking-widest">{title}</p>
      <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/[0.06] mx-4">
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-white/[0.05] mx-4" />
}

export default function Account() {
  const { darkMode, toggleDarkMode, refreshChannels, channelsLoading, channels } = useStore()

  const liveCount = channels.filter((c) => c.isLive).length

  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">

      {/* Profile card */}
      <div className="px-4 pt-6 pb-5">
        <div className="bg-[#111] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-black font-black text-xl">CF</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base">CricFusion</p>
            <p className="text-white/40 text-sm mt-0.5">Guest viewer</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
              <span className="text-brand-500 text-xs font-semibold">{liveCount} channels live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <Section title="Preferences">
        <Row
          icon={darkMode ? Moon : Sun}
          label="Dark Mode"
          value={darkMode ? 'On' : 'Off'}
          onClick={toggleDarkMode}
          accent="lime"
        />
        <Divider />
        <Row
          icon={Bell}
          label="Notifications"
          value="Off"
          onClick={() => {}}
          accent="blue"
        />
      </Section>

      {/* Channels */}
      <Section title="Channels">
        <Row
          icon={RefreshCw}
          label="Refresh Streams"
          value={channelsLoading ? 'Loading…' : `${channels.length} loaded`}
          onClick={refreshChannels}
          accent="lime"
        />
        <Divider />
        <Row
          icon={Tv2}
          label="Stream Quality"
          value="Auto"
          onClick={() => {}}
          accent="purple"
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row
          icon={Shield}
          label="Privacy"
          onClick={() => {}}
          accent="blue"
        />
        <Divider />
        <Row
          icon={Info}
          label="Version"
          value="1.0.0"
          onClick={() => {}}
        />
      </Section>

      {/* Sign out placeholder */}
      <div className="mx-4 mb-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors"
          onClick={() => {}}
        >
          <LogOut size={16} />
          Sign Out
        </motion.button>
      </div>

      {/* Developer credit */}
      <div className="flex items-center justify-center gap-1 mb-6 mt-3">
        <Heart size={9} className="text-red-500 fill-red-500" />
        <span className="text-white/20 text-[10px] font-medium tracking-wide">developed by</span>
        <span className="text-[10px] font-bold tracking-wide" style={{ color: 'rgba(200,255,0,0.5)' }}>Krishi</span>
      </div>

    </main>
  )
}
