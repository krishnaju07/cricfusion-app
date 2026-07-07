import rawHandler from '../../api/cf-dynamic.js'
import { toNetlifyFunction } from './_lib/adapter.js'

export const handler = toNetlifyFunction(rawHandler)
