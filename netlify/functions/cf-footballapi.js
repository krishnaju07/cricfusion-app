import rawHandler from '../../api/cf-footballapi.js'
import { toNetlifyFunction } from './_lib/adapter.js'

export const handler = toNetlifyFunction(rawHandler)
