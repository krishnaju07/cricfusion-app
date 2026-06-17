// ── Site-wide maintenance status via GitHub Gist ─────────────────────────────
// The Gist is PUBLIC (readable by everyone, no auth).
// Writing requires a GitHub Personal Access Token stored in localStorage.
//
// ONE-TIME SETUP (owner does this once):
//   1. Go to https://gist.github.com → create a public Gist
//      Filename: cricfusion-status.json
//      Content:  {"down":false,"message":""}
//   2. Copy the Gist ID from the URL (the long hash after your username)
//   3. Replace GIST_ID below with your Gist ID
//   4. To store your GitHub token in your browser (one time):
//      localStorage.setItem('cf_gh_token', 'ghp_YOUR_TOKEN_HERE')
//      (Token needs only the "gist" scope)

const GIST_ID   = '3925f7f5f1d01c9e30ca5b4b8f0819d8'
const GIST_FILE = 'cricfusion-status.json'
const RAW_URL   = `https://gist.githubusercontent.com/krishnaju07/${GIST_ID}/raw/${GIST_FILE}`
const API_URL   = `https://api.github.com/gists/${GIST_ID}`

// ── Read status (called by App on load + interval) ────────────────────────────
export async function fetchSiteStatus() {
  try {
    const res = await fetch(`${RAW_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()   // { down: boolean, message: string }
  } catch {
    return null
  }
}

// ── Write status (called by __cf.down / __cf.up in main.jsx) ─────────────────
async function updateGist(down, message = '') {
  const token = localStorage.getItem('cf_gh_token')
  if (!token) {
    console.error('%c❌ No GitHub token found.\nRun: localStorage.setItem(\'cf_gh_token\', \'ghp_...\')', 'color:red;font-size:13px')
    return false
  }
  try {
    const res = await fetch(API_URL, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILE]: {
            content: JSON.stringify({ down, message }, null, 2),
          },
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export const siteControl = {
  async down(message = 'We\'re making improvements. Back soon.') {
    const ok = await updateGist(true, message)
    if (ok) {
      console.log('%c🔴 Site is now DOWN for all users.', 'color:#f97316;font-size:14px;font-weight:800')
      window.dispatchEvent(new Event('cf_maintenance_change'))
    } else {
      console.error('Failed to update Gist. Check your token.')
    }
  },
  async up() {
    const ok = await updateGist(false, '')
    if (ok) {
      console.log('%c🟢 Site is back UP for all users.', 'color:#c8ff00;font-size:14px;font-weight:800')
      window.dispatchEvent(new Event('cf_maintenance_change'))
    } else {
      console.error('Failed to update Gist. Check your token.')
    }
  },
  async status() {
    const s = await fetchSiteStatus()
    if (!s) { console.log('Could not fetch status.'); return }
    const state = s.down ? '🔴 DOWN' : '🟢 UP'
    console.log(`%cSite status: ${state}${s.message ? `\nMessage: "${s.message}"` : ''}`, 'font-size:13px;font-weight:700')
  },
  setToken(token) {
    localStorage.setItem('cf_gh_token', token)
    console.log('%c✅ GitHub token saved.', 'color:#c8ff00;font-weight:700')
  },
}
