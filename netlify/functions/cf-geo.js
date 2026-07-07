import rawHandler from '../../api/cf-geo.js'
import { toNetlifyFunction } from './_lib/adapter.js'

const wrapped = toNetlifyFunction(rawHandler)

// The /cf-geo/* redirect forwards here as /.netlify/functions/cf-geo/<host>/<path...>
// (a path splat, not a query-string one — Netlify's :splat doesn't substitute
// correctly when placed inside a query-string value). Recover the upstream
// path from event.path and feed it in as the 'path' query param cf-geo.js expects.
export const handler = async (event, context) => {
  const path = event.path.replace(/^\/\.netlify\/functions\/cf-geo\/?/, '')
  const queryStringParameters = { ...(event.queryStringParameters || {}), path }
  return wrapped({ ...event, queryStringParameters }, context)
}
