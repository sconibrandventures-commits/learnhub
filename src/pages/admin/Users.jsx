import { useState } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Badge, Modal, PageHead, RoleBadge, Avatar, ConfirmButton } from '../../components/ui'
import { formatDate } from '../../lib/helpers'

const BLANK = { name: '', email: '', password: '', role: 'student' }

export default function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)

  const { data, loading, reload } = useAsync(() => backend.listUsers(), [])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const users = (data || []).filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return [u.name, u.email].filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  async function create(e) {
    e?.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required.')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.')
    setBusy(true)
    try {
      await backend.createUser(form)
      toast.success(`${form.name} has been created.`)
      setForm(BLANK)
      setOpen(false)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function setRole(u, role) {
    try { await backend.setUserRole(u.$id, role); toast.success(`${u.name} is now a ${role}.`); reload() }
    catch (err) { toast.error(err.message) }
  }

  async function setActive(u, isActive) {
    try {
      await backend.setUserActive(u.$id, isActive)
      toast.success(`${u.name} has been ${isActive ? 'enabled' : 'disabled'}.`)
      reload()
    } catch (err) { toast.error(err.message) }
  }

  async function remove(u) {
    try { await backend.deleteUser(u.$id); toast.success('Account deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Layout title="Users"><Spinner /></Layout>

  return (
    <Layout title="Users">
      <PageHead title="Users" subtitle="Create accounts and control who can do what.">
        <button className="btn btn--primary" onClick={() => setOpen(true)}><Icon name="plus" size={15} /> Add user</button>
      </PageHead>

      <div className="card mb-3">
        <div className="card__body row">
          <Icon name="search" size={17} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…" style={{ flex: 1, minWidth: 160 }} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All roles</option>
            <option value="admin">Administrators</option>
            <option value="instructor">Instructors</option>
            <option value="student">Students</option>
          </select>
        </div>
      </div>

      <div className="card">
        {users.length === 0 ? (
          <div className="table-empty">No users match that search.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.$id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={u.name} />
                        <div>
                          <div className="b">{u.name} {u.$id === me.$id && <Badge tone="brand">you</Badge>}</div>
                          <div className="tiny muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      {u.isActive === false ? <Badge tone="danger">Disabled</Badge> : <Badge tone="ok">Active</Badge>}
                    </td>
                    <td className="small muted">{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <select value={u.role} onChange={(e) => setRole(u, e.target.value)}
                          disabled={u.$id === me.$id} style={{ width: 'auto', padding: '5px 8px', fontSize: '.82rem' }}>
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button className="btn btn--sm" onClick={() => setActive(u, u.isActive === false)}
                          disabled={u.$id === me.$id}>
                          {u.isActive === false ? 'Enable' : 'Disable'}
                        </button>
                        <ConfirmButton onConfirm={() => remove(u)} confirmLabel="Delete account?"
                          className="btn btn--sm btn--ghost" >
                          <Icon name="trash" size={13} />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal title="Add a user" onClose={() => setOpen(false)} width={560}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
            </>
          }>
          <form onSubmit={create}>
            <div className="field">
              <label htmlFor="un">Full name</label>
              <input id="un" type="text" value={form.name} onChange={set('name')} placeholder="Chinedu Okafor" required />
            </div>
            <div className="field">
              <label htmlFor="ue">Email address</label>
              <input id="ue" type="email" value={form.email} onChange={set('email')} placeholder="name@school.com" required />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="up">Password</label>
                <input id="up" type="text" value={form.password} onChange={set('password')} placeholder="At least 8 characters" required />
                <div className="hint">Share this with them — they can change it later.</div>
              </div>
              <div className="field">
                <label htmlFor="ur">Role</label>
                <select id="ur" value={form.role} onChange={set('role')}>
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
