/* Small shared helpers used across the app. */

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'course'
}

/* ------------------------------------------------------------------ dates */

export function toISO(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function formatDate(value, opts = {}) {
  const d = value ? new Date(value) : null
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export function formatDateTime(value) {
  const d = value ? new Date(value) : null
  if (!d || isNaN(d.getTime())) return '—'
  return `${formatDate(d)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function formatTime(value) {
  const d = value ? new Date(value) : null
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "in 3 days", "2 hours ago", "now" */
export function timeAgo(value) {
  const d = value ? new Date(value) : null
  if (!d || isNaN(d.getTime())) return '—'
  const secs = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(secs)
  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2592000],
    ['year', 31536000],
  ]
  if (abs < 60) return secs >= 0 ? 'in a moment' : 'just now'
  let chosen = ['minute', 60]
  for (const u of units) if (abs >= u[1]) chosen = u
  const n = Math.round(abs / chosen[1])
  const label = `${n} ${chosen[0]}${n === 1 ? '' : 's'}`
  return secs >= 0 ? `in ${label}` : `${label} ago`
}

/* ------------------------------------------------------ live class timing */

export const CLASS_JOIN_WINDOW_MINUTES = 15

/**
 * Work out what state a class is in and whether the Join button should work.
 * Returns { state, canJoin, endsAt, minutesUntil, live }
 */
export function classWindow(cls, now = Date.now()) {
  const start = new Date(cls.startsAt).getTime()
  const end = start + Number(cls.durationMinutes || 0) * 60000
  const minutesUntil = Math.round((start - now) / 60000)
  const isFinished = cls.status === 'ended' || (cls.status !== 'cancelled' && now > end)
  const isLiveNow =
    cls.status !== 'cancelled' &&
    !isFinished &&
    (cls.status === 'live' || (now >= start - CLASS_JOIN_WINDOW_MINUTES * 60000 && now <= end))

  let state = 'upcoming'
  if (cls.status === 'cancelled') state = 'cancelled'
  else if (isFinished) state = 'ended'
  else if (now >= start && now <= end) state = 'live'
  else if (isLiveNow) state = 'starting'

  return {
    state,
    live: state === 'live',
    canJoin: isLiveNow && cls.status !== 'cancelled',
    endsAt: new Date(end).toISOString(),
    minutesUntil,
    hasEnded: isFinished,
  }
}

/** Countdown text: "Starts in 2h 15m" / "Ends in 12m" / "Live now" */
export function countdownText(cls, now = Date.now()) {
  const w = classWindow(cls, now)
  if (w.state === 'cancelled') return 'Cancelled'
  if (w.state === 'ended') return 'Ended'
  if (w.state === 'live') return `Live · ends in ${humanDuration(w.endsAt, now)}`
  return `Starts in ${humanDuration(cls.startsAt, now)}`
}

export function humanDuration(target, now = Date.now()) {
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return 'a moment'
  const mins = Math.floor(diff / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

/* ------------------------------------------------------------- assessment */

export function isAssessmentOpen(a, now = Date.now()) {
  if (!a.isPublished) return false
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return false
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return false
  return true
}

export function assessmentAvailability(a, now = Date.now()) {
  if (!a.isPublished) return { open: false, reason: 'Not published yet' }
  if (a.startsAt && new Date(a.startsAt).getTime() > now)
    return { open: false, reason: `Opens ${formatDateTime(a.startsAt)}` }
  if (a.endsAt && new Date(a.endsAt).getTime() < now)
    return { open: false, reason: 'Closed' }
  return { open: true, reason: 'Open' }
}

/* ------------------------------------------------------------------ misc */

export function percent(value, total) {
  if (!total) return 0
  return Math.round((Number(value) / Number(total)) * 10000) / 100
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function truncate(text, n = 120) {
  const s = String(text || '')
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s
}
