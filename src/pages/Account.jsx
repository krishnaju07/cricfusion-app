import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Bell, BellOff, Shield, Info,
  ChevronRight, LogOut, Heart, X, Check,
  Satellite, Smartphone, KeyRound, Trash2, ListVideo, Upload,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { FEATURES } from '../config/features'

const APP_VERSION = '1.0.0'

// ── Reusable toggle switch ────────────────────────────────────────────────────
function Toggle({ checked }) {
  return (
    <div className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 ${checked ? 'bg-brand-500' : 'bg-white/20'}`}>
      <motion.div
        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      />
    </div>
  )
}

// ── Settings row ──────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, value, onClick, accent, toggle, checked }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        accent === 'lime'   ? 'bg-brand-500/15' :
        accent === 'red'    ? 'bg-red-500/15' :
        accent === 'blue'   ? 'bg-blue-500/15' :
        accent === 'purple' ? 'bg-purple-500/15' :
        'bg-white/[0.06]'
      }`}>
        <Icon size={18} className={
          accent === 'lime'   ? 'text-brand-500' :
          accent === 'red'    ? 'text-red-400' :
          accent === 'blue'   ? 'text-blue-400' :
          accent === 'purple' ? 'text-purple-400' :
          'text-white/50'
        } />
      </div>
      <span className="flex-1 text-white text-sm font-medium text-left">{label}</span>
      {toggle
        ? <Toggle checked={checked} />
        : value !== undefined
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
      <div className="bg-dark-800 rounded-2xl overflow-hidden border border-white/[0.06] mx-4">
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-white/[0.05] mx-4" />
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-dark-800 rounded-t-3xl z-[55] border-t border-white/[0.06]"
            style={{ maxHeight: 'calc(82vh - 4rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <h2 className="text-white font-bold text-base">{title}</h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center"
              >
                <X size={15} className="text-white/60" />
              </motion.button>
            </div>
            <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 'calc(82vh - 4rem - 64px)' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Privacy section row ───────────────────────────────────────────────────────
function PrivacyBlock({ title, body }) {
  return (
    <div className="py-3 border-b border-white/[0.05] last:border-0">
      <p className="text-white/70 text-sm font-semibold mb-1">{title}</p>
      <p className="text-white/40 text-[13px] leading-relaxed">{body}</p>
    </div>
  )
}

// ── Version info row ──────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-white/40 text-sm">{label}</span>
      <span className="text-white/70 text-sm font-medium">{value}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Account() {
  const {
    refreshChannels, channelsLoading, channels,
    notificationsEnabled, toggleNotifications,
    tpCreds, setTpCreds, clearTpCreds,
    m3uUrl, setM3uUrl, m3uContent, setM3uContent,
  } = useStore()

  const [showPrivacy, setShowPrivacy]       = useState(false)
  const [showVersion, setShowVersion]       = useState(false)
  const [showTpLogin, setShowTpLogin]       = useState(false)
  const [showPlaylist, setShowPlaylist]     = useState(false)
  const [playlistMode, setPlaylistMode]     = useState('url')   // 'url' | 'paste'
  const [playlistInput, setPlaylistInput]   = useState('')
  const [pasteInput, setPasteInput]         = useState('')
  const [notifBlocked, setNotifBlocked]     = useState(false)
  const [cacheState, setCacheState]         = useState('idle') // 'idle' | 'clearing' | 'done'

  const clearCache = async () => {
    if (cacheState !== 'idle') return
    setCacheState('clearing')
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {}
    setCacheState('done')
    setTimeout(() => window.location.reload(), 1200)
  }

  // ── Tata Play OTP login state ─────────────────────────────────────────
  const [tpMobile, setTpMobile]     = useState('')
  const [tpOtp, setTpOtp]           = useState('')
  const [tpStep, setTpStep]         = useState('mobile') // 'mobile' | 'otp' | 'done'
  const [tpDevice, setTpDevice]     = useState(null)     // { deviceId, anonymousId }
  const [tpLoading, setTpLoading]   = useState(false)
  const [tpMsg, setTpMsg]           = useState('')

  const tpSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(tpMobile)) { setTpMsg('Enter a valid 10-digit mobile number'); return }
    setTpLoading(true); setTpMsg('')
    try {
      const r = await fetch('/api/tp-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: tpMobile }) })
      const data = await r.json()
      if (!r.ok) { setTpMsg(data.error || 'Failed to send OTP'); return }
      setTpDevice({ deviceId: data.deviceId, anonymousId: data.anonymousId })
      setTpMsg(data.message || 'OTP sent!')
      setTpStep('otp')
    } catch (e) { setTpMsg('Network error') } finally { setTpLoading(false) }
  }

  const tpVerifyOtp = async () => {
    if (!tpOtp || tpOtp.length < 4) { setTpMsg('Enter the OTP'); return }
    setTpLoading(true); setTpMsg('')
    try {
      const r = await fetch('/api/tp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: tpMobile, otp: tpOtp, ...tpDevice }),
      })
      const data = await r.json()
      if (!r.ok) { setTpMsg(data.error || 'Login failed'); return }
      setTpCreds({ subscriberId: data.subscriberId, userAuthenticateToken: data.userAuthenticateToken })
      setTpMsg('Logged in! Refreshing channels…')
      setTpStep('done')
      setTimeout(() => { refreshChannels(); setShowTpLogin(false) }, 1200)
    } catch (e) { setTpMsg('Network error') } finally { setTpLoading(false) }
  }

  const tpLogout = () => {
    clearTpCreds()
    setTpStep('mobile'); setTpMobile(''); setTpOtp(''); setTpMsg(''); setTpDevice(null)
    refreshChannels()
  }

  const tpChannelCount = channels.filter((c) => c.key?.startsWith('tp_')).length
  const playlistCount  = channels.filter((c) => c.key?.startsWith('m3u_')).length
  const liveCount = channels.filter((c) => c.isLive).length

  const handleToggleNotifications = async () => {
    await toggleNotifications()
    if ('Notification' in window && Notification.permission === 'denied') {
      setNotifBlocked(true)
    } else {
      setNotifBlocked(false)
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-dark-900 pb-safe no-scrollbar">

      {/* Profile card */}
      <div className="px-4 pt-6 pb-5">
        <div className="bg-dark-800 rounded-2xl border border-white/[0.06] p-5 flex items-center gap-4">
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
          icon={notificationsEnabled ? Bell : BellOff}
          label="Notifications"
          toggle
          checked={notificationsEnabled}
          onClick={handleToggleNotifications}
          accent="blue"
        />
        {notifBlocked && (
          <p className="px-4 pb-3 text-yellow-400/70 text-[11px] leading-relaxed">
            Notifications are blocked by your browser. Enable them in browser settings and try again.
          </p>
        )}
      </Section>

      {/* Tata Play */}
      {FEATURES.TATAPLAY && <Section title="Tata Play">
        {tpCreds ? (
          <>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                <Satellite size={18} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Logged in</p>
                <p className="text-white/40 text-xs mt-0.5 truncate">{tpCreds.subscriberId}</p>
              </div>
              <span className="text-brand-500 text-xs font-bold bg-brand-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                {tpChannelCount} ch
              </span>
            </div>
            <Divider />
            <Row
              icon={LogOut}
              label="Sign out of Tata Play"
              onClick={tpLogout}
              accent="red"
            />
          </>
        ) : (
          <Row
            icon={Satellite}
            label="Login with Tata Play"
            value="OTP"
            onClick={() => { setTpStep('mobile'); setTpMsg(''); setShowTpLogin(true) }}
            accent="lime"
          />
        )}
      </Section>}

      {/* Playlist */}
      <Section title="Playlist">
        {(m3uUrl || m3uContent) ? (
          <>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <ListVideo size={18} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Custom Playlist</p>
                <p className="text-white/40 text-xs mt-0.5 truncate">
                  {m3uContent ? 'Pasted M3U content' : m3uUrl}
                </p>
              </div>
              {playlistCount > 0 && (
                <span className="text-purple-400 text-xs font-bold bg-purple-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                  {playlistCount} ch
                </span>
              )}
            </div>
            <Divider />
            <Row
              icon={Trash2}
              label="Remove Playlist"
              onClick={() => { setM3uUrl(''); setM3uContent(''); refreshChannels() }}
              accent="red"
            />
          </>
        ) : (
          <Row
            icon={ListVideo}
            label="Add Playlist"
            value="M3U"
            onClick={() => { setPlaylistInput(''); setPasteInput(''); setShowPlaylist(true) }}
            accent="purple"
          />
        )}
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
          icon={Trash2}
          label={cacheState === 'clearing' ? 'Clearing…' : cacheState === 'done' ? 'Cleared — reloading' : 'Clear Stream Cache'}
          value={cacheState === 'idle' ? 'Fixes buffering' : undefined}
          onClick={clearCache}
          accent="red"
        />
      </Section>

      {/* About */}
      <Section title="About">
        <Row
          icon={Shield}
          label="Privacy"
          onClick={() => setShowPrivacy(true)}
          accent="blue"
        />
        <Divider />
        <Row
          icon={Info}
          label="Version"
          value={APP_VERSION}
          onClick={() => setShowVersion(true)}
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

      <div className="flex items-center justify-center gap-1 mb-6 mt-3">
        <Heart size={9} className="text-red-500 fill-red-500" />
        <span className="text-white/20 text-[10px] font-medium tracking-wide">developed by</span>
        <span className="text-[10px] font-bold tracking-wide" style={{ color: 'rgba(200,255,0,0.5)' }}>Krishi</span>
      </div>

      {/* ── Privacy Sheet ── */}
      <BottomSheet open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy">
        <div className="px-5 py-2 pb-6">
          <PrivacyBlock
            title="Data Collection"
            body="CricFusion does not collect, store, or transmit any personal data. No account or registration is required."
          />
          <PrivacyBlock
            title="Stream Sources"
            body="Video streams are sourced from third-party providers. CricFusion aggregates publicly accessible stream URLs and acts only as a player interface."
          />
          <PrivacyBlock
            title="Local Storage"
            body="Preferences such as theme and notifications are saved only to your device's local storage. This data never leaves your device."
          />
          <PrivacyBlock
            title="Analytics & Tracking"
            body="No analytics, advertising trackers, crash reporters, or telemetry of any kind are used or embedded."
          />
          <PrivacyBlock
            title="Service Worker"
            body="A service worker proxies stream requests to protect source URLs. No request data is logged, stored, or shared."
          />
        </div>
      </BottomSheet>

      {/* ── Tata Play Login Sheet ── */}
      {FEATURES.TATAPLAY && <BottomSheet open={showTpLogin} onClose={() => setShowTpLogin(false)} title="Tata Play Login">
        <div className="px-5 py-4 pb-8 space-y-4">
          <p className="text-white/40 text-[13px] leading-relaxed">
            Login with any Indian mobile number. All Tata Play channels load directly in CricFusion — no external server needed.
          </p>

          <AnimatePresence mode="wait">
            {tpStep === 'mobile' && (
              <motion.div key="mobile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">Mobile Number</label>
                  <div className="flex items-center bg-dark-900 border border-white/[0.1] rounded-xl overflow-hidden focus-within:border-brand-500/60 transition-colors">
                    <span className="px-3 text-white/40 text-sm font-medium border-r border-white/[0.08] py-3">+91</span>
                    <input
                      type="tel" maxLength={10} value={tpMobile}
                      onChange={(e) => setTpMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => e.key === 'Enter' && tpSendOtp()}
                      placeholder="9XXXXXXXXX"
                      className="flex-1 bg-transparent px-3 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none"
                      autoComplete="tel" inputMode="numeric"
                    />
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }} onClick={tpSendOtp} disabled={tpLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(200,255,0,0.9) 0%, rgba(160,220,0,0.95) 100%)' }}
                >
                  {tpLoading ? 'Sending…' : <><Smartphone size={15} />Send OTP</>}
                </motion.button>
              </motion.div>
            )}

            {tpStep === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                <div className="flex items-center gap-2 text-white/50 text-[13px]">
                  <span>OTP sent to</span>
                  <span className="text-white font-semibold">+91 {tpMobile}</span>
                  <button onClick={() => setTpStep('mobile')} className="ml-auto text-brand-400 text-xs hover:text-brand-300">Change</button>
                </div>
                <div className="space-y-1">
                  <label className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">Enter OTP</label>
                  <input
                    type="tel" maxLength={6} value={tpOtp}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setTpOtp(v) }}
                    onKeyDown={(e) => e.key === 'Enter' && tpVerifyOtp()}
                    placeholder="• • • • • •"
                    autoFocus
                    className="w-full bg-dark-900 border border-white/[0.1] rounded-xl px-4 py-3 text-white text-center text-xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-white/20 focus:outline-none focus:border-brand-500/60 transition-colors"
                    inputMode="numeric"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }} onClick={tpVerifyOtp} disabled={tpLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-black disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(200,255,0,0.9) 0%, rgba(160,220,0,0.95) 100%)' }}
                >
                  {tpLoading ? 'Verifying…' : <><KeyRound size={15} />Verify OTP</>}
                </motion.button>
              </motion.div>
            )}

            {tpStep === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full bg-brand-500/20 flex items-center justify-center">
                  <Check size={28} className="text-brand-500" />
                </div>
                <p className="text-white font-bold text-base">Logged in!</p>
                <p className="text-white/40 text-sm text-center">Loading Tata Play channels…</p>
              </motion.div>
            )}
          </AnimatePresence>

          {tpMsg ? (
            <p className={`text-[13px] text-center ${tpMsg.includes('success') || tpMsg.includes('sent') || tpMsg.includes('Logged') ? 'text-brand-400' : 'text-red-400'}`}>
              {tpMsg}
            </p>
          ) : null}

          <p className="text-white/20 text-[11px] text-center leading-relaxed">
            Works with any Indian mobile — no Tata Play subscription required for login.
          </p>
        </div>
      </BottomSheet>}

      {/* ── Playlist Sheet ── */}
      <BottomSheet open={showPlaylist} onClose={() => setShowPlaylist(false)} title="Add Playlist">
        {/* Tab switcher */}
        <div className="flex mx-5 mt-4 rounded-xl overflow-hidden bg-dark-900 border border-white/[0.08]">
          <button
            onClick={() => setPlaylistMode('url')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${playlistMode === 'url' ? 'bg-brand-500 text-black' : 'text-white/40 hover:text-white/60'}`}
          >
            URL
          </button>
          <button
            onClick={() => setPlaylistMode('paste')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${playlistMode === 'paste' ? 'bg-brand-500 text-black' : 'text-white/40 hover:text-white/60'}`}
          >
            Paste M3U
          </button>
        </div>

        <div className="px-5 py-4 pb-8 space-y-4">
          {playlistMode === 'url' ? (
            <>
              <p className="text-white/40 text-[13px] leading-relaxed">
                Enter a publicly accessible M3U URL. URLs protected by bot detection (e.g. la.drmlive.net) won't work here — use <span className="text-white/60">Paste M3U</span> instead.
              </p>
              <div className="space-y-1">
                <label className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">Playlist URL</label>
                <input
                  type="url"
                  value={playlistInput}
                  onChange={(e) => setPlaylistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const url = playlistInput.trim()
                      if (url.startsWith('http')) { setM3uUrl(url); setShowPlaylist(false); refreshChannels() }
                    }
                  }}
                  placeholder="https://example.com/playlist.m3u"
                  autoFocus
                  className="w-full bg-dark-900 border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-500/60 transition-colors"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const url = playlistInput.trim()
                  if (!url.startsWith('http')) return
                  setM3uContent('')
                  setM3uUrl(url)
                  setShowPlaylist(false)
                  refreshChannels()
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, rgba(200,255,0,0.9) 0%, rgba(160,220,0,0.95) 100%)' }}
              >
                <ListVideo size={15} />Save Playlist
              </motion.button>
            </>
          ) : (
            <>
              <p className="text-white/40 text-[13px] leading-relaxed">
                Open your playlist URL in a browser tab, select all text (Ctrl+A), copy and paste below. Or load a .m3u file from your device.
              </p>
              <div className="space-y-1">
                <label className="text-white/50 text-[11px] font-semibold uppercase tracking-wider">M3U Content</label>
                <textarea
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder={'#EXTM3U\n#EXTINF:-1,Channel Name\nhttp://stream.url/...'}
                  rows={6}
                  className="w-full bg-dark-900 border border-white/[0.1] rounded-xl px-4 py-3 text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-brand-500/60 transition-colors resize-none"
                />
              </div>
              <label className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.1] text-white/40 text-sm cursor-pointer hover:border-white/20 hover:text-white/60 transition-colors">
                <Upload size={15} />
                Load from .m3u file
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => setPasteInput(ev.target?.result || '')
                    reader.readAsText(file)
                  }}
                />
              </label>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const text = pasteInput.trim()
                  if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) return
                  setM3uUrl('')
                  setM3uContent(text)
                  setShowPlaylist(false)
                  refreshChannels()
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, rgba(200,255,0,0.9) 0%, rgba(160,220,0,0.95) 100%)' }}
              >
                <ListVideo size={15} />Load Playlist
              </motion.button>
            </>
          )}
          <p className="text-white/20 text-[11px] text-center leading-relaxed">
            Supports M3U / M3U8. DRM streams may require additional setup.
          </p>
        </div>
      </BottomSheet>

      {/* ── Version Sheet ── */}
      <BottomSheet open={showVersion} onClose={() => setShowVersion(false)} title="About CricFusion">
        <div className="px-5 py-4 pb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-black font-black text-lg">CF</span>
            </div>
            <div>
              <p className="text-white font-bold text-base">CricFusion</p>
              <p className="text-white/40 text-sm">Version {APP_VERSION}</p>
            </div>
          </div>

          <div className="bg-dark-900 rounded-xl border border-white/[0.06] px-4 mb-4">
            <InfoRow label="Version"   value={APP_VERSION} />
            <InfoRow label="Platform"  value="Web App (PWA)" />
            <InfoRow label="Player"    value="HLS.js + Shaka" />
            <InfoRow label="Framework" value="React 19 + Vite" />
          </div>

          <div className="p-4 bg-brand-500/[0.07] border border-brand-500/20 rounded-xl">
            <p className="text-brand-400 text-xs font-bold uppercase tracking-wider mb-2">
              What's New in v{APP_VERSION}
            </p>
            <ul className="text-white/40 text-[12px] space-y-1.5">
              {[
                'Multi-source stream aggregation (jtvv, FanCode, Sony LIV)',
                'DASH + HLS dual player with DRM support',
                'Live captions via SpeechRecognition API (beta)',
                'Swipe gestures for brightness & volume',
                'Pinch-to-zoom & picture enhancement',
                'PWA install support',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BottomSheet>

    </main>
  )
}
