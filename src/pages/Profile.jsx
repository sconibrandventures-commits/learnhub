import { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'
import backend from '../lib/backend'
import { Icon, Avatar, Badge, PageHead, Alert } from '../components/ui'
import { isDemo } from '../lib/backend'
import { formatDate } from '../lib/helpers'

export default function Profile() {
  const { user, refresh } = useAuth()
  const toast = useToast()

  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Your name cannot be empty.')
    setSavingProfile(true)
    try {
      await backend.updateProfile(user.$id, { name })
      await refresh()
      toast.success('Profile updated.')
    } catch (err) { toast.error(err.message) } finally { setSavingProfile(false) }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwError('')
    if (pw.next.length < 8) return setPwError('Your new password must be at least 8 characters.')
    if (pw.next !== pw.confirm) return setPwError('The two new passwords do not match.')
    setSavingPw(true)
    try {
      await backend.changePassword(user.$id, pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast.success('Password changed.')
    } catch (err) { setPwError(err.message) } finally { setSavingPw(false) }
  }

  async function resetDemoData() {
    if (!window.confirm('Reset the demo data back to how it started? Any changes you made will be lost.')) return
    try {
      await backend.resetDemo()
      window.location.href = '/login'
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Layout title="My profile">
      <PageHead title="My profile" subtitle="Update your name and password." />

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><h3>Account</h3></div>
          <div className="card__body">
            <div className="row mb-3" style={{ gap: 14 }}>
              <Avatar name={user.name} size="lg" />
              <div>
                <div className="b" style={{ fontSize: '1.05rem' }}>{user.name}</div>
                <div className="muted small">{user.email}</div>
                <div className="row mt-1" style={{ gap: 6 }}>
                  <Badge tone={user.role === 'admin' ? 'danger' : user.role === 'instructor' ? 'brand' : 'info'}>
                    {user.role}
                  </Badge>
                  {user.createdAt && <span className="tiny muted">joined {formatDate(user.createdAt)}</span>}
                </div>
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="pn">Full name</label>
                <input id="pn" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="pe">Email address</label>
                <input id="pe" type="email" value={user.email} disabled />
                <div className="hint">Ask an administrator if you need your email address changed.</div>
              </div>
              <button className="btn btn--primary" disabled={savingProfile || name === user.name}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__head"><h3><Icon name="lock" size={16} /> Change password</h3></div>
            <div className="card__body">
              {pwError && <div className="auth-err">{pwError}</div>}
              <form onSubmit={savePassword}>
                <div className="field">
                  <label htmlFor="pc">Current password</label>
                  <input id="pc" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="pn2">New password</label>
                    <input id="pn2" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label htmlFor="pc2">Confirm new password</label>
                    <input id="pc2" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
                  </div>
                </div>
                <button className="btn btn--primary" disabled={savingPw}>{savingPw ? 'Saving…' : 'Change password'}</button>
              </form>
            </div>
          </div>

          {isDemo && (
            <div className="card">
              <div className="card__head"><h3><Icon name="refresh" size={16} /> Demo data</h3></div>
              <div className="card__body">
                <Alert tone="info">
                  You're in demo mode. Everything — including accounts you create — is stored only in this browser.
                </Alert>
                <button className="btn mt-2" onClick={resetDemoData}>
                  <Icon name="refresh" size={15} /> Reset demo data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
