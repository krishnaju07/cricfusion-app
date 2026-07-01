// Shared UI metadata for channel display — used by ChannelCard, Sidebar, etc.

export const VPN_FLAG = {
  DE: '🇩🇪', AT: '🇦🇹', BE: '🇧🇪', SK: '🇸🇰', CZ: '🇨🇿', FR: '🇫🇷',
  IE: '🇮🇪', CA: '🇨🇦', SA: '🇸🇦', BR: '🇧🇷', TR: '🇹🇷', PL: '🇵🇱',
  SE: '🇸🇪', NO: '🇳🇴',
}

export const VPN_NAME = {
  DE: 'Germany', AT: 'Austria', BE: 'Belgium', SK: 'Slovakia', CZ: 'Czech Republic',
  FR: 'France', IE: 'Ireland', CA: 'Canada', SA: 'Saudi Arabia', BR: 'Brazil',
  TR: 'Turkey', PL: 'Poland', SE: 'Sweden', NO: 'Norway',
}

// Map a channel's key prefix to a human-readable source label shown on cards.
export function getChannelSource(ch) {
  const key = ch.key || ''
  if (key.startsWith('fc_'))  return 'FanCode'
  if (key.startsWith('sl_'))  return 'SonyLIV'
  if (key.startsWith('tp_'))  return 'TataPlay'
  if (key.startsWith('dl_'))  return 'DRMLive'
  if (key.startsWith('m3u_')) return 'Custom'
  if (ch.category === 'fifa2026') return 'FIFA 2026'
  if (ch.category === 'wc2026live') return 'WC Live'
  return null
}

// Count channels per tab (mirrors the filter logic in Home.jsx).
export function buildCategoryCounts(channels) {
  const counts = { all: channels.length }
  for (const ch of channels) {
    if (ch.category) counts[ch.category] = (counts[ch.category] || 0) + 1
  }
  // Key-prefix tabs
  counts.fancode  = channels.filter((c) => c.key?.startsWith('fc_')).length
  counts.sonyliv  = channels.filter((c) => c.key?.startsWith('sl_')).length
  counts.tataplay = channels.filter((c) => c.key?.startsWith('tp_')).length
  counts.playlist = channels.filter((c) => c.key?.startsWith('m3u_')).length
  return counts
}
