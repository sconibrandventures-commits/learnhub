import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, homeFor } from '../state/AuthContext'
import { Icon } from '../components/ui'
import { isDemo } from '../lib/backend'
import { config } from '../config'

const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@learnhub.test', icon: 'shield', tone: 'danger' },
  { role: 'Instructor', email: 'teacher@learnhub.test', icon: 'video', tone: 'brand' },
  { role: 'Student — 2 courses', email: 'ngozi@learnhub.test', icon: 'user', tone: 'info' },
  { role: 'Student — 1 course', email: 'tunde@learnhub.test', icon: 'lock', tone: 'info' },
]

function Shell({ children, title, subtitle }) {
  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 430 }}>
        <div className="auth-brand">
          <div className="logo">L</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{config.appName}</div>
            <div style={{ fontSize: '.78rem', opacity: .85 }}>Live video training portal</div>
          </div>
        </div>
        <div className="auth-card">
          <h1>{title}</h1>
          <div className="sub">{subtitle}</div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = await login(email, password)
      navigate(homeFor(user.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  function fill(demoEmail) {
    setEmail(demoEmail)
    setPassword('password')
    setError('')
  }

  return (
    <Shell title="Welcome back" subtitle="Sign in to continue to your classes.">
      {error && <div className="auth-err">{error}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required autoComplete="email" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{ width: '100%', paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                borderRadius: '4px',
              }}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-alt" style={{ fontSize: '.82rem', color: '#64748b', lineHeight: 1.45 }}>
        Access is restricted to authorized students and staff. Accounts are created and provisioned by your administrator.
      </div>
    </Shell>
  )
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', code: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Your password must be at least 8 characters long.')
    if (form.password !== form.confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      const user = await register({
        name: form.name, email: form.email, password: form.password, code: form.code,
      })
      navigate(homeFor(user.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Create your account" subtitle="It only takes a moment.">
      {error && <div className="auth-err">{error}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" type="text" value={form.name} onChange={set('name')} placeholder="Adaeze Okonkwo" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat it" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="code">Course enrolment code <span className="muted">(optional)</span></label>
          <input id="code" type="text" value={form.code} onChange={set('code')} placeholder="e.g. WEB-101" />
          <div className="hint">
            Got a code from your instructor? Enter it here and you'll be enrolled in that course straight away.
          </div>
        </div>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="auth-alt">
        Already registered? <Link to="/login">Sign in</Link>
      </div>
    </Shell>
  )
}
