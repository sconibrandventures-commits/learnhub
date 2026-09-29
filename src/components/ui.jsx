import { useEffect, useState } from 'react'

/* ------------------------------------------------------------- icons */
/* Inline SVG — no icon font, no CDN, works offline. */

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4zM20 4h-3a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z',
  video: 'M15 10.5 21 7v10l-6-3.5M3 6.5A1.5 1.5 0 0 1 4.5 5h9A1.5 1.5 0 0 1 15 6.5v11A1.5 1.5 0 0 1 13.5 19h-9A1.5 1.5 0 0 1 3 17.5z',
  clipboard: 'M9 4h6v3H9zM8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M8 12h8M8 16h5',
  quiz: 'M9 9a3 3 0 1 1 4.5 2.6c-.8.5-1.5 1-1.5 2M12 17.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  chat: 'M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-5A8 8 0 1 1 21 12z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  users: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  cog: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.3 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 2.3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  play: 'M5 3l14 9-14 9z',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  right: 'M9 18l6-6-6-6',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15 7m0 0l3 3 2-2-3-3z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
}

export function Icon({ name, size = 18, className = '', filled = false }) {
  const d = PATHS[name] || PATHS.help
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flex: '0 0 auto' }}
    >
      <path d={d} />
    </svg>
  )
}

/* ------------------------------------------------------------ badges */

const TONES = ['brand', 'ok', 'warn', 'danger', 'info', 'live']

export function Badge({ tone = '', children, pulse = false, ...rest }) {
  const cls = TONES.includes(tone) ? `badge badge--${tone}` : 'badge'
  return <span className={cls} {...rest}>{children}</span>
}

export function StatusBadge({ status }) {
  const map = {
    active: ['ok', 'Active'],
    pending: ['warn', 'Pending'],
    suspended: ['danger', 'Suspended'],
    completed: ['info', 'Completed'],
    live: ['live', 'Live'],
    scheduled: ['info', 'Scheduled'],
    ended: ['', 'Ended'],
    cancelled: ['danger', 'Cancelled'],
    published: ['ok', 'Published'],
    draft: ['', 'Draft'],
    submitted: ['info', 'Submitted'],
    graded: ['ok', 'Graded'],
    returned: ['ok', 'Returned'],
    in_progress: ['warn', 'In progress'],
    needs_marking: ['warn', 'Needs marking'],
    passed: ['ok', 'Passed'],
    failed: ['danger', 'Failed'],
  }
  const [tone, label] = map[status] || ['', status]
  return <Badge tone={tone} pulse={status === 'live'}>{status === 'live' && <span className="dot pulse" />}{label}</Badge>
}

export function RoleBadge({ role }) {
  const map = { admin: 'danger', instructor: 'brand', student: 'info' }
  return <Badge tone={map[role] || ''}>{role}</Badge>
}

/* ---------------------------------------------------------- feedback */

export function Spinner({ label }) {
  return (
    <div className="center-load">
      <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
        <div className="spinner" style={{ width: 30, height: 30 }} />
        {label && <small className="muted">{label}</small>}
      </div>
    </div>
  )
}

export function Empty({ icon = 'folder', title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty">
      <div className="big"><Icon name={icon} size={40} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={`alert alert--${tone}`}>
      <Icon name={tone === 'danger' ? 'alert' : tone === 'ok' ? 'check' : 'help'} size={17} />
      <div>
        {title && <b>{title}</b>}
        <div>{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- stats */

export function Stat({ label, value, hint, variant, icon }) {
  return (
    <div className={variant === 'brand' ? 'stat stat--brand' : 'stat'}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  )
}

/* ------------------------------------------------------------- modal */

export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog">
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close"><Icon name="x" size={17} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  )
}

/** Button that asks for confirmation inline before running the action. */
export function ConfirmButton({ onConfirm, children, className = 'btn btn--sm', confirmLabel = 'Are you sure?', danger = true }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])

  if (!armed) {
    return (
      <button className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArmed(true) }}>
        {children}
      </button>
    )
  }
  return (
    <button
      className={danger ? 'btn btn--danger btn--sm' : 'btn btn--primary btn--sm'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArmed(false); onConfirm() }}
    >
      {confirmLabel}
    </button>
  )
}

/* ------------------------------------------------------------ misc */

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head row row--between">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function Avatar({ name, size }) {
  const letters = String(name || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('')
  return <div className={size === 'lg' ? 'av av--lg' : 'av'}>{letters}</div>
}

export function ProgressBar({ value, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const cls = tone || (v >= 70 ? 'ok' : v >= 40 ? 'warn' : 'danger')
  return (
    <div className={`progress progress--${cls}`}>
      <span style={{ width: `${v}%` }} />
    </div>
  )
}
