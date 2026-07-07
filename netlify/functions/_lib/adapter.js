// Wraps a Vercel/Express-style (req, res) handler so it runs as a classic
// Netlify Function (event, context) -> { statusCode, headers, body }.
// Lets api/*.js handlers run unmodified on Netlify.

function lowercaseHeaders(h) {
  const out = {}
  for (const k in h) out[k.toLowerCase()] = h[k]
  return out
}

export function toNetlifyFunction(rawHandler) {
  return async (event) => {
    const rawBody = event.body
      ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body))
      : null

    const req = {
      method: event.httpMethod,
      query: event.queryStringParameters || {},
      headers: lowercaseHeaders(event.headers || {}),
      url: event.rawUrl || event.path,
      async *[Symbol.asyncIterator]() {
        if (rawBody) yield rawBody
      },
    }

    let statusCode = 200
    const headers = {}
    let body = ''
    let isBase64Encoded = false

    function setBody(payload) {
      if (payload == null) { body = ''; return }
      if (Buffer.isBuffer(payload)) {
        body = payload.toString('base64')
        isBase64Encoded = true
      } else {
        body = String(payload)
      }
    }

    const res = {
      get statusCode() { return statusCode },
      set statusCode(v) { statusCode = v },
      status(code) { statusCode = code; return res },
      setHeader(key, value) { headers[key] = value; return res },
      getHeader(key) { return headers[key] },
      end(payload) { if (payload !== undefined) setBody(payload); return res },
      send(payload) { setBody(payload); return res },
      json(payload) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
        body = JSON.stringify(payload)
        return res
      },
    }

    await rawHandler(req, res)

    return { statusCode, headers, body, isBase64Encoded }
  }
}
