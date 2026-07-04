// Feature flags — flip to false to hide the feature across the app.
export const FEATURES = {
  TATAPLAY:    false,  // set true to enable TataPlay channels in the app
  MULTIVIEW:   false,  // set true to enable the Multi-View page and bottom nav tab
  IPTV_TAMIL:  false,  // set true to include IPTV Tamil channels (famelack India/tam)
  IPTV_SPORTS: true,   // set true to include global sports channels (famelack sports)
  DRMLIVE:     false,  // cf-drmlive uses curl (bypasses JA3 bot-check) to fetch la.drmlive.net playlist
}
