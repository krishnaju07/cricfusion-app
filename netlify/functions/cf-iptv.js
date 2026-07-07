import rawHandler from '../../api/cf-iptv.js'
import { toNetlifyFunction } from './_lib/adapter.js'

export const handler = toNetlifyFunction(rawHandler)
