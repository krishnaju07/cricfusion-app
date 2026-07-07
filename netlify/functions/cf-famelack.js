import rawHandler from '../../api/cf-famelack.js'
import { toNetlifyFunction } from './_lib/adapter.js'

export const handler = toNetlifyFunction(rawHandler)
