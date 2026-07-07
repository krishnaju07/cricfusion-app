import rawHandler from '../../api/cf-m6.js'
import { toNetlifyFunction } from './_lib/adapter.js'

export const handler = toNetlifyFunction(rawHandler)
