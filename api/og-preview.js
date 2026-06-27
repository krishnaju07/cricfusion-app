// Vercel serverless — serve OG-enriched HTML to link-preview bots
// visiting /watch/:id so WhatsApp/Telegram/Twitter show a thumbnail.
// Regular browsers receive the normal index.html SPA shell instead.

import fs   from 'fs'
import path from 'path'

const SITE      = 'https://cricfusion.vercel.app'
const OG_IMAGE  = `${SITE}/og-image.svg`

const BOT_UA = /facebookexternalhit|twitterbot|whatsapp|telegrambot|telegrambot|linkedinbot|slackbot|discordbot|applebot|googlebot|bingbot|iMessage|vkshare|outbrain|quora/i

export default function handler(req, res) {
  const ua  = req.headers['user-agent'] || ''
  const id  = req.query.id || ''
  const url = `${SITE}/watch/${id}`

  // ── Bot: return OG HTML ──────────────────────────────────────────────────────
  if (BOT_UA.test(ua)) {
    const title = `Watch Live Sports on CricFusion`
    const desc  = `Live Cricket, Football, FIFA World Cup 2026 and more in HD — free, no sign-up. Now streaming on CricFusion.`

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type"         content="website">
  <meta property="og:site_name"    content="CricFusion">
  <meta property="og:title"        content="${title}">
  <meta property="og:description"  content="${desc}">
  <meta property="og:url"          content="${url}">
  <meta property="og:image"        content="${OG_IMAGE}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt"    content="CricFusion Live Sports Streaming">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image"       content="${OG_IMAGE}">
</head>
<body>
  <p>Loading CricFusion…</p>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.status(200).send(html)
  }

  // ── Regular browser: serve the SPA shell (index.html) ───────────────────────
  try {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html')
    const html = fs.readFileSync(indexPath, 'utf-8')
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch {
    // Fallback: redirect (dev mode where dist/ doesn't exist yet)
    return res.redirect(302, url)
  }
}
