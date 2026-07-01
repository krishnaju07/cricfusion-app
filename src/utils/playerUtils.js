// Pure utility functions for the video player.
// Kept separate from VideoPlayer.jsx to keep the component focused on UI/state.

// Extract the __hdnea__ token from a Jio CDN URL to re-append on segment requests.
export function extractToken(url) {
  const match = url.match(/[?&](__hdnea__=[^&]+)/)
  return match ? match[1] : null
}

// Strips Widevine PSSH boxes from binary MP4 init segments.
// Shaka reads PSSH boxes from init segments and tries to initialise the matching
// CDM (Widevine = edef8ba9-…). Removing them prevents the Widevine CDM attempt
// while leaving the encryption parameters intact for ClearKey.
export function stripWidevinePssh(input) {
  try {
    const src = input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input.buffer, input.byteOffset ?? 0, input.byteLength)

    const u32 = (a, i) => ((a[i] << 24) | (a[i+1] << 16) | (a[i+2] << 8) | a[i+3]) >>> 0

    function process(a, start, end) {
      const chunks = []; let pos = start
      while (pos + 8 <= end) {
        const sz = u32(a, pos)
        if (sz < 8 || pos + sz > end) break
        const t = String.fromCharCode(a[pos+4], a[pos+5], a[pos+6], a[pos+7])
        // Skip Widevine PSSH: system ID at pos+12 starts with ed ef 8b a9
        if (t === 'pssh' && sz >= 28 &&
            a[pos+12] === 0xed && a[pos+13] === 0xef && a[pos+14] === 0x8b && a[pos+15] === 0xa9) {
          pos += sz; continue
        }
        // Recurse into moov to catch nested PSSH
        if (t === 'moov') {
          const inner = process(a, pos + 8, pos + sz)
          const nSz = 8 + inner.length
          const box = new Uint8Array(nSz)
          box[0] = (nSz >>> 24) & 0xFF; box[1] = (nSz >>> 16) & 0xFF
          box[2] = (nSz >>> 8) & 0xFF;  box[3] = nSz & 0xFF
          box[4] = 0x6D; box[5] = 0x6F; box[6] = 0x6F; box[7] = 0x76  // 'moov'
          box.set(inner, 8); chunks.push(box); pos += sz; continue
        }
        chunks.push(a.slice(pos, pos + sz)); pos += sz
      }
      let total = 0; for (const c of chunks) total += c.length
      const out = new Uint8Array(total); let off = 0
      for (const c of chunks) { out.set(c, off); off += c.length }
      return out
    }

    return process(src, 0, src.length).buffer
  } catch { return input }
}

// Derive an HLS URL from a DASH MPD URL for Safari native playback.
// Amazon IVS and CMAF CDNs always expose parallel HLS endpoints.
export function deriveSafariHlsUrl(mpd) {
  if (!mpd) return null
  // Proxy URLs (m3u-proxy, tp-mpd-proxy, etc.) point to server-side fetched content —
  // there's no parallel HLS URL at the same proxy path.
  if (mpd.startsWith('/api/')) return null
  // Amazon IVS: /clients/dash/enc/.../cenc.mpd → /clients/hls/enc/.../index.m3u8
  if (mpd.includes('/clients/dash/enc/')) {
    return mpd.replace('/clients/dash/enc/', '/clients/hls/enc/').replace(/\/cenc\.mpd$/, '/index.m3u8')
  }
  // Generic CMAF: master.mpd → master.m3u8, index.mpd → index.m3u8
  if (mpd.endsWith('master.mpd')) return mpd.replace('master.mpd', 'master.m3u8')
  if (mpd.endsWith('index.mpd'))  return mpd.replace('index.mpd',  'index.m3u8')
  // Last-resort: many CDNs (bitgravity, Sun Direct, etc.) serve parallel HLS at .m3u8
  if (mpd.endsWith('.mpd')) return mpd.replace(/\.mpd$/, '.m3u8')
  return null
}
