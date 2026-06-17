import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={handle} className="ml-2 text-white/30 hover:text-brand-400 transition-colors flex-shrink-0">
      {copied ? <Check size={13} className="text-brand-400" /> : <Copy size={13} />}
    </button>
  )
}

function CodeLine({ code, desc }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center flex-1 min-w-0">
        <code className="text-brand-400 font-mono text-xs bg-brand-500/10 px-2 py-1 rounded-lg whitespace-nowrap">
          {code}
        </code>
        <CopyBtn text={code} />
      </div>
      <p className="text-white/35 text-xs leading-relaxed text-right flex-shrink-0 max-w-[180px]">{desc}</p>
    </div>
  )
}

function Section({ title, badge, badgeColor = 'bg-white/10 text-white/40', children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
        <h2 className="text-white font-bold text-sm">{title}</h2>
        {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
      </div>
      <div className="px-4 py-1">{children}</div>
    </motion.div>
  )
}

export default function OwnerRef() {
  return (
    <main className="flex-1 overflow-y-auto bg-black pb-safe no-scrollbar">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center font-black text-black text-sm">CF</div>
          <div>
            <h1 className="text-white font-black text-xl tracking-tight">Owner Reference</h1>
            <p className="text-white/30 text-xs">Console commands & localStorage keys — keep private</p>
          </div>
          <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
            🔒 Private
          </span>
        </div>

        {/* Step 1 — Unlock console */}
        <Section title="Step 1 — Unlock Console" badge="Do this first" badgeColor="bg-yellow-500/15 text-yellow-400">
          <CodeLine
            code={`localStorage.setItem('cf_dev', '1')`}
            desc="Bypass devtools guard. Run once per browser."
          />
          <CodeLine
            code={`localStorage.removeItem('cf_dev')`}
            desc="Re-enable guard for that browser."
          />
        </Section>

        {/* Maintenance mode */}
        <Section title="Maintenance Mode" badge="Affects ALL users" badgeColor="bg-orange-500/15 text-orange-400">
          <CodeLine code={`__cf.down()`}                  desc="Shut site down for everyone." />
          <CodeLine code={`__cf.down('Back in 1 hour')`}  desc="Shutdown with custom message." />
          <CodeLine code={`__cf.up()`}                    desc="Restore site for everyone." />
          <CodeLine code={`__cf.status()`}                desc="Check live status from Gist." />
          <CodeLine code={`__cf.setToken('ghp_...')`}     desc="Save GitHub token (one time)." />
        </Section>

        {/* One-time Gist setup */}
        <Section title="One-Time Gist Setup" badge="Do once" badgeColor="bg-blue-500/15 text-blue-400">
          <CodeLine code={`https://gist.github.com`}      desc="1. Create public Gist named cricfusion-status.json" />
          <CodeLine code={`{"down":false,"message":""}`}  desc="2. Initial Gist content" />
          <CodeLine code={`src/utils/site-status.js`}     desc="3. Paste Gist ID into GIST_ID constant" />
          <CodeLine code={`__cf.setToken('ghp_...')`}     desc="4. Run in console to save GitHub token (gist scope only)" />
        </Section>

        {/* LocalStorage keys */}
        <Section title="LocalStorage Keys" badge="All cf_ keys">
          <CodeLine code={`cf_dev`}         desc="'1' = devtools guard bypassed" />
          <CodeLine code={`cf_maintenance`} desc="'1' = maintenance mode ON" />
          <CodeLine code={`cf_darkMode`}    desc="'true' / 'false'" />
          <CodeLine code={`cf_quality`}     desc="Auto / 1080p / 720p / 480p / 360p" />
          <CodeLine code={`cf_favorites`}   desc="JSON array of channel IDs" />
          <CodeLine code={`cf_m3uUrl`}      desc="Custom M3U playlist URL" />
          <CodeLine code={`cf_tpCreds`}     desc="Tata Play credentials (JSON)" />
          <CodeLine code={`cf_notifications`} desc="'1' = notifications enabled" />
        </Section>

        {/* Clear everything */}
        <Section title="Reset / Clear" badge="Danger" badgeColor="bg-red-500/15 text-red-400">
          <CodeLine
            code={`localStorage.clear()`}
            desc="Wipe all cf_ keys. User sees fresh state."
          />
          <CodeLine
            code={`localStorage.removeItem('cf_favorites')`}
            desc="Clear saved favourites only."
          />
          <CodeLine
            code={`localStorage.removeItem('cf_tpCreds')`}
            desc="Log out Tata Play."
          />
        </Section>

        {/* URL reference */}
        <Section title="Hidden Routes" badge="URLs">
          <CodeLine code={`/cf-owner`} desc="This page — owner reference." />
        </Section>

        <p className="text-center text-white/15 text-[10px] pb-4">
          This page is not linked from anywhere. Keep the URL private.
        </p>

      </div>
    </main>
  )
}
