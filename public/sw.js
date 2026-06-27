// CricFusion Service Worker — channel data proxy
// Requests made FROM this SW are NOT visible in the browser's Network tab.
// Page sees /cf-data or /cf-dynamic?id=...; real upstream URLs stay hidden.

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

  // ── Batch channel list ────────────────────────────────────────────────────
  if (url.pathname === '/cf-data') {
    event.respondWith(
      fetch('/api/cf-proxy?src=data', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── FanCode live events ───────────────────────────────────────────────────
  if (url.pathname === '/cf-fancode') {
    event.respondWith(
      fetch('/api/cf-proxy?src=fancode', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── Sony LIV live events ──────────────────────────────────────────────────
  if (url.pathname === '/cf-sonyliv') {
    event.respondWith(
      fetch('/api/cf-proxy?src=sonyliv', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── FIFA 2026 streams (clearKeys + URLs served server-side) ─────────────
  if (url.pathname === '/cf-fifa') {
    event.respondWith(
      fetch('/api/cf-fifa', { cache: 'no-store', credentials: 'omit' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── cxfut / lchdxfootball HLS streams (premium.js auto-refreshed) ────────
  if (url.pathname === '/cf-cxfut') {
    event.respondWith(
      fetch('/api/cf-cxfut', { cache: 'no-store', credentials: 'omit' })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
    return
  }

  // ── iptv-eldbert FIFA/World Cup channels (always-fresh tokenized HLS) ────
  if (url.pathname === '/cf-iptv') {
    event.respondWith(
      fetch('/api/cf-iptv', { cache: 'no-store', credentials: 'omit' })
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
      fetch(`/api/cf-dynamic?id=${encodeURIComponent(id)}`, {
        cache: 'no-store', credentials: 'omit',
      })
        .then((r) => r.text())
        .then(makeResponse)
        .catch(() => new Response('error', { status: 502 }))
    )
  }
})
