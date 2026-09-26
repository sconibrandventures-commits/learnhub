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
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-alt">
        New here? <Link to="/register">Create an account</Link>
      </div>

      {isDemo && (
        <div className="demo-accounts">
          <b>Demo accounts — click to fill in (password: password)</b>
          {DEMO_ACCOUNTS.map((a) => (
            <div className="row row--between" key={a.email}>
              <span>
                <Icon name={a.icon} size={13} /> {a.role}
              </span>
              <span>
                <code>{a.email}</code>
                <button className="fill" type="button" onClick={() => fill(a.email)}>use</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!isDemo && (
        <div className="demo-accounts">
          <b>Connected to Appwrite</b>
          <span className="tiny">{config.endpoint}</span>
        </div>
      )}
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
