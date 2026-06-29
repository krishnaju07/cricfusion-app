import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'url'
import nodePath from 'path'

const AKAMAI = 'sonydaimenew.akamaized.net'
//
const SL_PARTNERS = 'sonypartnersdaimenew.akamaized.net'

function slProxyUrl(url, hdnea) {
  let out = url
  if (out.startsWith(`https://${AKAMAI}/`)) {
    out = '/sl-cdn/' + out.slice(`https://${AKAMAI}/`.length)
  } else if (out.startsWith(`https://${SL_PARTNERS}/`)) {
    out = '/sl-cdn/' + out.slice(`https://${SL_PARTNERS}/`.length)
    out += out.includes('?') ? '&host=p' : '?host=p'
  }
  if (hdnea && !out.includes('hdnea=')) {
    out += out.includes('?') ? `&hdnea=${hdnea}` : `?hdnea=${hdnea}`
  }
  return out
}

function rewriteSlM3u8(text, hdnea) {
  let out = text.replace(/^(?!#|\s*$)(.+)$/gm, (line) => slProxyUrl(line.trim(), hdnea))
  out = out.replace(/(URI=")([^"]+)(")/g, (_, a, uri, b) => `${a}${slProxyUrl(uri, hdnea)}${b}`)
  return out
}

// Dev-time proxy for /sl-cdn that mirrors the Vercel Edge Function:
// fetches from Akamai, rewrites manifest URLs, adds CORS headers.
function sonyLivDevProxy() {
  return {
    name: 'sl-cdn-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/sl-cdn/')) return next()

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', '*')
          res.statusCode = 204
          return res.end()
        }

        const slicedUrl = req.url.slice('/sl-cdn'.length)
        const qIdx = slicedUrl.indexOf('?')
        const slPath = qIdx >= 0 ? slicedUrl.slice(0, qIdx) : slicedUrl
        const rawQuery = qIdx >= 0 ? slicedUrl.slice(qIdx + 1) : ''
        const parts = rawQuery.split('&')
        const isPartners = parts.some((p) => p === 'host=p')
        const akamaiHost = isPartners ? SL_PARTNERS : AKAMAI
        const cleanQuery = parts.filter((p) => p !== 'host=p').join('&')
        const upstream = `https://${akamaiHost}${slPath}${cleanQuery ? '?' + cleanQuery : ''}`

        let hdnea = ''
        try { hdnea = new URL(upstream).searchParams.get('hdnea') || '' } catch {}

        const proxyAbort = new AbortController()
        const proxyTimeout = setTimeout(() => proxyAbort.abort(), 10000)
        try {
          const r = await fetch(upstream, {
            signal: proxyAbort.signal,
            headers: {
              'accept': '*/*',
              'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
              'dnt': '1',
              'origin': 'https://www.sonyliv.com',
              'referer': 'https://www.sonyliv.com/',
              'priority': 'u=1, i',
              'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'cross-site',
              'sec-fetch-storage-access': 'active',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
              ...(req.headers['range'] && { 'range': req.headers['range'] }),
            },
          })
          clearTimeout(proxyTimeout)

          const ct = r.headers.get('content-type') || 'application/octet-stream'
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'no-cache, no-store')
          res.setHeader('Content-Type', ct)
          res.statusCode = r.status

          if (ct.includes('mpegurl') || /\.m3u8/.test(slPath)) {
            const text = rewriteSlM3u8(await r.text(), hdnea)
            return res.end(text)
          }

          const buf = Buffer.from(await r.arrayBuffer())
          return res.end(buf)
        } catch (err) {
          console.error('[sl-cdn-dev-proxy]', err.message)
          res.statusCode = 502
          return res.end('sl-cdn proxy error')
        }
      })
    },
  }
}

// Dev-time proxy for /api/cf-m6 — proxies M6 France manifest with correct Origin header
function m6DevProxy() {
  return {
    name: 'm6-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cf-m6')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-m6.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, headers: { referer: 'http://localhost:5173' } }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b) { res.statusCode = this._status; res.end(b) },
            send(b) { res.statusCode = this._status; res.end(b) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[m6-api-dev]', e)
          res.statusCode = 500; res.end('dev error: ' + e.message)
        }
      })
    },
  }
}

// Dev-time proxy for /api/cf-fifa — runs the Vercel handler locally
function fifaDevProxy() {
  return {
    name: 'fifa-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cf-fifa')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-fifa.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, headers: { referer: 'http://localhost:5173' } }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[fifa-api-dev]', e)
          res.statusCode = 500; res.end('dev error: ' + e.message)
        }
      })
    },
  }
}

// Dev-time proxies for Tata Play OTP login + channel/MPD APIs
// These forward requests to the same external APIs the Vercel functions call.
function tpApiDevProxy() {
  return {
    name: 'tp-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        // /api/tp-otp  /api/tp-login  /api/tp-channels  /api/tp-mpd
        if (!url.startsWith('/api/tp-otp') && !url.startsWith('/api/tp-login') &&
            !url.startsWith('/api/tp-channels') && !url.startsWith('/api/tp-mpd?')) return next()

        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); res.statusCode = 204; return res.end() }

        // Collect body for POST requests
        let body = {}
        if (req.method === 'POST') {
          const raw = await new Promise((resolve) => {
            const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString()))
          })
          try { body = JSON.parse(raw) } catch {}
        }
        const qs = new URL(url, 'http://localhost')

        try {
          // Absolute file:// URL + timestamp query busts Node's ESM module cache so
          // edits to api/*.js files take effect without restarting the dev server.
          const handlerName = url.split('?')[0].replace('/api/', '')
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', handlerName + '.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, query: Object.fromEntries(qs.searchParams), body, headers: req.headers }
          const fakeRes = {
            _status: 200, _headers: {}, _body: null,
            status(c) { this._status = c; return this },
            end(b) { res.setHeader('Content-Type', this._headers['Content-Type'] || 'text/plain'); res.statusCode = this._status; res.end(b) },
            send(b) { res.setHeader('Content-Type', this._headers['Content-Type'] || 'text/plain'); res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { this._headers[k] = v; res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[tp-api-dev-proxy]', e)
          if (!res.headersSent) { res.statusCode = 500; res.end('Dev proxy error: ' + e.message) }
        }
      })
    },
  }
}

// Shared JWKS normalizer (mirrors api/tp-license.js).
// Browser's ClearKey EME requires exact base64url encoding for kid/k;
// UUID-format or hex values produce error 6008 LICENSE_RESPONSE_REJECTED.
function _hexToBase64url(hex) {
  return Buffer.from(hex.replace(/-/g, ''), 'hex')
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function _toBase64url(s) {
  if (!s) return s
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return _hexToBase64url(s)
  if (/^[0-9a-f]{32,}$/i.test(s)) return _hexToBase64url(s)
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function _normalizeJwks(raw, requestedKids) {
  if (!raw) return null
  if (Array.isArray(raw?.keys)) {
    return { keys: raw.keys.map(k => ({ kty: 'oct', k: _toBase64url(k.k || k.key || k.KEY), kid: _toBase64url(k.kid || k.KID) })).filter(k => k.k), type: 'temporary' }
  }
  const keyVal = raw?.k || raw?.key || raw?.KEY
  if (keyVal) {
    const kid = raw?.kid || raw?.KID || requestedKids?.[0]
    return { keys: [{ kty: 'oct', k: _toBase64url(keyVal), kid: _toBase64url(kid) }], type: 'temporary' }
  }
  return null
}

// Dev-time proxy for /api/tp-license?id=... — ClearKey license server
function tpLicenseDevProxy() {
  return {
    name: 'tp-license-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tp-license')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')
        if (req.method === 'OPTIONS') return res.end()
        const id = new URL(req.url, 'http://localhost').searchParams.get('id')
        if (!id) { res.statusCode = 400; return res.end('Missing id') }
        let body = '{}'
        if (req.method === 'POST') {
          body = await new Promise((resolve) => {
            const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks).toString()))
          })
        }
        let requestedKids = []
        try { requestedKids = JSON.parse(body).kids || [] } catch {}
        try {
          const r = await fetch(`https://tp.drmlive-01.workers.dev?id=${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://watch.tataplay.com', 'Referer': 'https://watch.tataplay.com/', 'Content-Type': 'application/json' },
            body,
          })
          const raw = await r.json()
          console.log('[tp-license-dev] worker raw:', JSON.stringify(raw))
          if (raw === null) { res.statusCode = 404; return res.end('Key not found') }
          const jwks = _normalizeJwks(raw, requestedKids)
          if (!jwks?.keys?.length) { res.statusCode = 502; return res.end('Could not normalize key') }
          console.log('[tp-license-dev] normalized:', JSON.stringify(jwks))
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(jwks))
        } catch (e) { res.statusCode = 502; return res.end('tp-license error: ' + e.message) }
      })
    },
  }
}

// Dev-time proxy for /api/tp-mpd-proxy?url=... — fetches MPD + injects ClearKey entry
function tpMpdProxyDev() {
  return {
    name: 'tp-mpd-proxy-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tp-mpd-proxy')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') return res.end()
        const rawUrl = new URL(req.url, 'http://localhost').searchParams.get('url')
        if (!rawUrl) { res.statusCode = 400; return res.end('Missing url') }
        let targetUrl
        try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl) } catch { res.statusCode = 400; return res.end('Invalid URL') }
        try {
          const r = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Referer': 'https://watch.tataplay.com/', 'Origin': 'https://watch.tataplay.com' },
          })
          let text = await r.text()
          // Robust KID extraction (any namespace prefix, optional curly braces)
          const kidMatch = text.match(/default_KID="\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?"/i)
          const kid = kidMatch ? kidMatch[1].toLowerCase() : null
          // Strip Widevine (edef8ba9), PlayReady (9a04f079), and all PSSH blobs
          text = text.replace(/<ContentProtection[^>]*edef8ba9[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
          text = text.replace(/<ContentProtection[^>]*9a04f079[^>]*(?:\/>|>[\s\S]*?<\/ContentProtection>)/gi, '')
          text = text.replace(/<(?:\w+:)?pssh[^>]*>[\s\S]*?<\/(?:\w+:)?pssh>/gi, '')
          if (kid) {
            const ck = `<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey1.0"><cenc:default_KID>${kid}</cenc:default_KID></ContentProtection>`
            if (text.includes('<ContentProtection')) {
              // Inject ClearKey before every ContentProtection (handles all AdaptationSets)
              text = text.replace(/<ContentProtection/g, `${ck}\n        <ContentProtection`)
            } else {
              text = text.replace(/<Representation/g, `${ck}\n        <Representation`)
            }
          }
          res.setHeader('Content-Type', 'application/dash+xml')
          res.setHeader('Cache-Control', 'no-cache')
          return res.end(text)
        } catch (e) { res.statusCode = 502; return res.end('tp-mpd-proxy error') }
      })
    },
  }
}

// Dev-time proxy for /api/tp-wv-license — Widevine license proxy for Tata Play bpaita channels.
// Reads raw binary Widevine challenge, calls content API for Irdeto URL, forwards challenge.
function tpWvLicenseDevProxy() {
  return {
    name: 'tp-wv-license-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tp-wv-license')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

        const qs = new URL(req.url, 'http://localhost')
        const id  = qs.searchParams.get('id')
        const sub = qs.searchParams.get('sub')
        const tok = qs.searchParams.get('tok')
        if (!id || !sub || !tok) { res.statusCode = 400; return res.end('Missing params') }

        // Read raw binary Widevine challenge before creating the mock request
        const rawBody = await new Promise((resolve) => {
          const chunks = []
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })

        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'tp-wv-license.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)

          // Simulate Node.js req streaming so the handler's req.on('data') works
          const mockReq = {
            method: req.method,
            query: { id, sub, tok },
            headers: req.headers,
            on(event, fn) {
              if (event === 'data') process.nextTick(() => fn(rawBody))
              else if (event === 'end') process.nextTick(() => fn())
              return this
            },
          }
          const mockRes = {
            _status: 200, _headers: {},
            status(c) { this._status = c; return this },
            end(b)  { res.statusCode = this._status; res.end(b) },
            send(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { this._headers[k] = v; res.setHeader(k, v) },
          }
          await mod.default(mockReq, mockRes)
        } catch (e) {
          console.error('[tp-wv-license-dev]', e.message)
          if (!res.headersSent) { res.statusCode = 502; res.end('Dev proxy error: ' + e.message) }
        }
      })
    },
  }
}

// Dev-time proxy for /api/m3u-proxy?url=... — fetches the M3U server-side
function m3uDevProxy() {
  return {
    name: 'm3u-proxy-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/m3u-proxy')) return next()
        const rawUrl = new URL(req.url, 'http://localhost').searchParams.get('url')
        if (!rawUrl) { res.statusCode = 400; return res.end('Missing ?url=') }
        let targetUrl
        try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl) } catch { res.statusCode = 400; return res.end('Invalid URL') }
        try {
          const r = await fetch(targetUrl, { headers: { 'User-Agent': 'TiviMate/4.6.0 (Android)', 'Accept': '*/*' } })
          const text = await r.text()
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/x-mpegurl')
          res.statusCode = r.status
          return res.end(text)
        } catch (err) {
          console.error('[m3u-proxy-dev]', err.message)
          res.statusCode = 502; return res.end('m3u proxy error')
        }
      })
    },
  }
}

// Dev-time proxy for /api/cf-famelack — fetches, gunzips, and filters Tamil channels
function famelackDevProxy() {
  return {
    name: 'famelack-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cf-famelack')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const qs = new URL(req.url, 'http://localhost')
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-famelack.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, query: Object.fromEntries(qs.searchParams), headers: req.headers }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[famelack-api-dev]', e)
          res.statusCode = 500; res.end('dev error: ' + e.message)
        }
      })
    },
  }
}

// Dev-time proxy for /cf-stream/(.*) — mirrors the Vercel path-based route locally
function streamDevProxy() {
  return {
    name: 'cf-stream-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/cf-stream/')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-stream.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const path = req.url.slice('/cf-stream/'.length).split('?')[0]
          const fakeReq = {
            method: req.method,
            query: { path },
            headers: { referer: 'http://localhost:5173', ...req.headers },
          }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b)  { res.statusCode = this._status; res.end(b) },
            send(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[cf-stream-dev]', e)
          res.statusCode = 502; res.end('stream proxy error: ' + e.message)
        }
      })
    },
  }
}

// Dev-time proxy for /api/cf-footballapi — runs the Vercel handler locally
function footballapiDevProxy() {
  return {
    name: 'footballapi-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cf-footballapi')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-footballapi.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, headers: { referer: 'http://localhost:5173' } }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[footballapi-dev]', e)
          res.statusCode = 500; res.end('dev error: ' + e.message)
        }
      })
    },
  }
}

// Dev-time proxy for /api/cf-iptv — runs the Vercel handler locally
function iptvDevProxy() {
  return {
    name: 'iptv-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/cf-iptv')) return next()
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        try {
          const handlerUrl = pathToFileURL(nodePath.join(process.cwd(), 'api', 'cf-iptv.js')).href + `?t=${Date.now()}`
          const mod = await import(handlerUrl)
          const fakeReq = { method: req.method, headers: { referer: 'http://localhost:5173' } }
          const fakeRes = {
            _status: 200,
            status(c) { this._status = c; return this },
            end(b) { res.statusCode = this._status; res.end(b) },
            json(b) { res.setHeader('Content-Type', 'application/json'); res.statusCode = this._status; res.end(JSON.stringify(b)) },
            setHeader(k, v) { res.setHeader(k, v) },
          }
          await mod.default(fakeReq, fakeRes)
        } catch (e) {
          console.error('[iptv-api-dev]', e)
          res.statusCode = 500; res.end('dev error: ' + e.message)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sonyLivDevProxy(), m3uDevProxy(), tpLicenseDevProxy(), tpWvLicenseDevProxy(), tpMpdProxyDev(), tpApiDevProxy(), fifaDevProxy(), m6DevProxy(), iptvDevProxy(), famelackDevProxy(), footballapiDevProxy(), streamDevProxy()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/api/cf-data': {
        target: 'https://jtvv.pages.dev',
        changeOrigin: true,
        rewrite: () => '/channels.json',
      },
      '/api/cf-fancode': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: () => '/drmlive/fancode-live-events/main/fancode.json',
      },
      '/api/cf-sonyliv': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: () => '/drmlive/sliv-live-events/main/sonyliv.json',
      },
      '/cf-sonyliv': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: () => '/drmlive/sliv-live-events/main/sonyliv.json',
      },
      '/api/cf-dynamic': {
        target: 'https://newwwwapiiiiii.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cf-dynamic/, '/main'),
      },
      '/fc-cdn': {
        target:       'https://in-mc-fblive.fancode.com',
        changeOrigin: true,
        rewrite:      (path) => path.replace(/^\/fc-cdn/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('sec-fetch-site')
            proxyReq.removeHeader('sec-fetch-mode')
            proxyReq.removeHeader('sec-fetch-dest')
            proxyReq.removeHeader('sec-fetch-storage-access')
            proxyReq.removeHeader('sec-fetch-user')
          })
        },
      },
    },
  },
})
