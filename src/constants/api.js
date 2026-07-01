// All server-side proxy paths and external API base URLs.
// The SW intercepts these /cf-* paths and forwards them to the real upstreams,
// keeping upstream URLs out of the browser Network tab.

// SW-intercepted paths (same-origin)
export const DYNAMIC_PROXY    = '/cf-dynamic'
export const FANCODE_PROXY    = '/cf-fancode'
export const SONYLIV_PROXY    = '/cf-sonyliv'
export const FIFA_PROXY       = '/cf-fifa'
export const IPTV_PROXY       = '/cf-iptv'
export const CXFUT_PROXY      = '/cf-cxfut'
export const FOOTSTERS_PROXY  = '/cf-footsters'
export const FOOTBALLAPI_PROXY = '/cf-footballapi'

// Direct upstream URLs (CORS-open, no SW needed)
export const STARSONY_URL = 'https://sayan-json-4.pages.dev/Data/sports.json'

// DRMLive playlist — routed through m3u-proxy (TiviMate UA via curl bypasses bot detection)
export const DRMLIVE_M3U = 'https://la.drmlive.net/tp/playlist'

// SW fallback URLs when SW controller is not yet active (first page load)
export const FANCODE_RAW = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json'
export const SONYLIV_RAW = 'https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json'
export const JAPIWEB_RAW = (id) => `https://japiweb.vercel.app/api/main?id=${id}`
