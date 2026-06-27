// Vercel serverless — serve OG-enriched HTML to link-preview bots
// visiting /watch/:id so WhatsApp/Telegram/Twitter show a thumbnail.
// Regular browsers receive the normal index.html SPA shell instead.

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SITE     = 'https://cricfusion.vercel.app'
const OG_IMAGE = `${SITE}/og-image.jpeg`

const BOT_UA = /facebookexternalhit|twitterbot|whatsapp|telegrambot|linkedinbot|slackbot|discordbot|applebot|googlebot|bingbot|imessage|vkshare|outbrain|quora|crawl|spider|preview/i

function readSpaHtml() {
  const fnDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(fnDir, '..', 'dist', 'index.html'),
  ]
  for (const p of candidates) {
    try { return fs.readFileSync(p, 'utf-8') } catch {}
  }
  return null
}

export default async function handler(req, res) {
  const ua  = req.headers['user-agent'] || ''
  const id  = req.query.id || ''
  const url = `${SITE}/watch/${id}`

  // ── Bot: return OG-enriched HTML ─────────────────────────────────────────────
  if (BOT_UA.test(ua)) {
    const title = 'Watch Live Sports on CricFusion'
    const desc  = 'Live Cricket, Football, FIFA World Cup 2026 and more in HD — free, no sign-up.'

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="CricFusion">
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url"         content="${url}">
  <meta property="og:image"       content="${OG_IMAGE}">
  <meta property="og:image:type"  content="image/jpeg">
  <meta property="og:image:alt"   content="CricFusion Live Sports Streaming">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image"      content="${OG_IMAGE}">
</head>
<body><p>Loading CricFusion…</p></body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).send(html)
  }

  // ── Regular browser: serve the SPA shell ─────────────────────────────────────
  let html = readSpaHtml()

  if (!html) {
    // Fallback: fetch from our own CDN (root URL serves dist/index.html directly)
    try {
      const r = await fetch(`${SITE}/`, { headers: { 'User-Agent': 'CricFusion-Internal/1.0' } })
      if (r.ok) html = await r.text()
    } catch {}
  }

  if (html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  }

  // Absolute last resort — redirect to root (avoids circular /watch/* loop)
  return res.redirect(302, '/')
}
