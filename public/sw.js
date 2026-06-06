// CricFusion Service Worker — channel data proxy
// Requests made FROM this SW are NOT visible in the browser's Network tab.
// Page sees /cf-data or /cf-dynamic?id=...; real upstream URLs stay hidden.

const BATCH_URL    = 'https://jtvv.pages.dev/channels.json'
const DYNAMIC_URL  = '/api/cf-dynamic'
const FANCODE_URL  = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json'

function b64(text) {
  return btoa(unescape(encodeURIComponent(text)))
}

function makeResponse(text) {
  return new Response(b64(text), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}

self.addEventListener('install',  ()  => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // ── Batch channel list (jtvv) ─────────────────────────────────────────────
  if (url.pathname === '/cf-data') {
    event.respondWith(
      fetch(BATCH_URL, { cache: 'no-store', credentials: 'omit' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── FanCode live events ───────────────────────────────────────────────────
  if (url.pathname === '/cf-fancode') {
    event.respondWith(
      fetch(FANCODE_URL, { cache: 'no-store', credentials: 'omit' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── Per-channel dynamic fetch ─────────────────────────────────────────────
  if (url.pathname === '/cf-dynamic') {
    const id = url.searchParams.get('id')
    if (!id) return
    event.respondWith(
      fetch(`${DYNAMIC_URL}?id=${encodeURIComponent(id)}`, {
        cache: 'no-store', credentials: 'omit',
      })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
  }
})
