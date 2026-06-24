// DevTools deterrent layer
// ─────────────────────────────────────────────────────────────────────────────
// Blocks common DevTools keyboard shortcuts, detects open DevTools via window
// size heuristic, and blanks the page while they're open.
// NOT unbreakable — a determined user can always use browser menus. This stops
// casual inspection and keeps stream URLs out of quick reach.
//
// BYPASS (run once in any browser you own):
//   localStorage.setItem('cf_dev', '1')
// That browser will never trigger the guard.

const BYPASS_KEY  = 'cf_dev'
const OVERLAY_ID  = '__cf_guard_overlay__'
const CHECK_MS    = 800   // how often to check window size

// Keys to swallow: F12, Ctrl/Cmd + Shift + I / J / C / K, Ctrl + U / S
function isBlockedKey(e) {
  if (e.key === 'F12') return true
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.shiftKey && ['i','I','j','J','c','C','k','K'].includes(e.key)) return true
  if (mod && ['u','U'].includes(e.key)) return true
  return false
}

function createOverlay() {
  if (document.getElementById(OVERLAY_ID)) return
  const el = document.createElement('div')
  el.id = OVERLAY_ID
  Object.assign(el.style, {
    position:        'fixed',
    inset:           '0',
    zIndex:          '2147483647',
    background:      '#0a0a0f',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             '16px',
    fontFamily:      'Inter, system-ui, sans-serif',
    userSelect:      'none',
  })
  el.innerHTML = `
    <div style="font-size:48px">🔒</div>
    <p style="color:#f97316;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.5px">
      CricFusion
    </p>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0;text-align:center;max-width:280px">
      Playback paused while developer tools are open.
    </p>
  `
  document.body.appendChild(el)
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove()
}

export function isDevToolsOpen() {
  // On phones and tablets the address bar + nav bar + status bar can easily
  // add 160–300 px to outerHeight, causing false positives. Skip the size
  // heuristic on any touch-capable device (covers all phones and tablets,
  // including Android tablets whose UA doesn't always contain "Mobi").
  const isTouchDevice = navigator.maxTouchPoints > 0
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isTouchDevice || isMobileUA) return false

  const wDiff = window.outerWidth  - window.innerWidth
  const hDiff = window.outerHeight - window.innerHeight
  return wDiff > 160 || hDiff > 160
}

export function installGuard() {
  // Skip entirely for the owner's browser
  if (localStorage.getItem(BYPASS_KEY) === '1') return

  // 1. Block keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (isBlockedKey(e)) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }, true)

  // 2. Disable right-click context menu
  window.addEventListener('contextmenu', (e) => e.preventDefault(), true)

  // 3. Flood the console so the Console tab is useless for quick reads
  const flood = () => {
    console.clear()
    console.log('%cStop!', 'color:red;font-size:48px;font-weight:900')
    console.log('%cThis browser feature is intended for developers. Unauthorised use may expose private stream data.', 'font-size:14px')
  }
  setInterval(flood, 3000)
  flood()

  // 4. Periodic window-size DevTools detection
  let wasOpen = false
  setInterval(() => {
    const open = isDevToolsOpen()
    if (open && !wasOpen) { wasOpen = true;  createOverlay() }
    if (!open && wasOpen) { wasOpen = false; removeOverlay() }
  }, CHECK_MS)

  // 5. Disable text selection globally (makes it harder to copy URLs from elements)
  document.addEventListener('selectstart', (e) => e.preventDefault())

  // 6. Block drag-and-drop (prevents dragging video src)
  document.addEventListener('dragstart', (e) => e.preventDefault())
}
