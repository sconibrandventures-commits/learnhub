/**
 * The single object the UI talks to.
 *
 * It is either the in-browser demo backend or the real Appwrite backend —
 * decided once, at startup, from src/config.js.
 */
import { DEMO_MODE } from '../config'
import { demoBackend } from './demoBackend'
import { realBackend } from './realBackend'

export const backend = DEMO_MODE ? demoBackend : realBackend
export const isDemo = DEMO_MODE
export default backend
