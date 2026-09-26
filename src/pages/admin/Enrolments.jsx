import { useState } from 'react'
import Layout from '../../components/Layout'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Badge, Modal, PageHead, StatusBadge, ConfirmButton, Empty } from '../../components/ui'
import { formatDate } from '../../lib/helpers'

export default function AdminEnrolments() {
  const toast = useToast()
  const [courseFilter, setCourseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(null)

  const { data, loading, reload } = useAsync(async () => {
    const [enrolments, courses] = await Promise.all([
      backend.listEnrolments(),
      backend.listCourses(),
    ])
    const students = (await backend.listUsers()).filter((u) => u.role === 'student')
    return { enrolments, courses, students }
  }, [])

  async function setStatus(e, status) {
    setBusy(e.$id)
    try {
      await backend.setEnrolmentStatus(e.$id, status)
      toast.success(`${e.user?.name || 'Student'} → ${status}.`)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(null) }
  }

  async function remove(e) {
    setBusy(e.$id)
    try { await backend.removeEnrolment(e.$id); toast.success('Enrolment removed.'); reload() }
    catch (err) { toast.error(err.message) } finally { setBusy(null) }
  }

  if (loading) return <Layout title="Enrolments"><Spinner /></Layout>

  const { enrolments = [], courses = [], students = [] } = data || {}

  const rows = enrolments.filter((e) => {
    if (courseFilter !== 'all' && e.courseId !== courseFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (![e.user?.name, e.user?.email, e.course?.title].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <Layout title="Enrolments">
      <PageHead
        title="Enrolments"
        subtitle="The master switch for course access. Activating gives instant access; suspending removes it immediately."
      >
        <button className="btn btn--primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={15} /> Enrol a student
        </button>
      </PageHead>

      <div className="alert alert--info mb-3">
        <Icon name="shield" size={17} />
        <div>
          <b>How access works</b>
          <div>
            A student can only open a course they have an <b>active</b> enrolment for. Suspend them here and the course,
            its classes, the Zoom join link, assignments and chat all disappear for that student straight away.
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card__body row">
          <Icon name="search" size={17} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student or course…" style={{ flex: 1, minWidth: 150 }} />
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All courses</option>
            {courses.map((c) => <option key={c.$id} value={c.$id}>{c.title}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <Empty icon="key" title="No enrolments found">
            {enrolments.length === 0
              ? 'Nobody has been enrolled yet. Use “Enrol a student” to get started.'
              : 'No enrolments match your filters.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Course</th><th>Status</th><th>Enrolled</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.$id}>
                    <td>
                      <div className="b">{e.user?.name || 'Unknown'}</div>
                      <div className="tiny muted">{e.user?.email}</div>
                    </td>
                    <td>
                      <div>{e.course?.title || 'Unknown course'}</div>
                      <div className="tiny muted mono">{e.course?.code}</div>
                    </td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="small muted">{e.enrolledAt ? formatDate(e.enrolledAt) : '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {e.status !== 'active' && (
                          <button className="btn btn--sm btn--ok" disabled={busy === e.$id}
                            onClick={() => setStatus(e, 'active')}>
                            <Icon name="check" size={13} /> Activate
                          </button>
                        )}
                        {e.status === 'active' && (
                          <button className="btn btn--sm" disabled={busy === e.$id}
                            onClick={() => setStatus(e, 'suspended')}>
                            <Icon name="lock" size={13} /> Suspend
                          </button>
                        )}
                        {e.status === 'pending' && (
                          <button className="btn btn--sm" disabled={busy === e.$id}
                            onClick={() => remove(e)}>Decline</button>
                        )}
                        <ConfirmButton onConfirm={() => remove(e)} confirmLabel="Remove?" className="btn btn--sm btn--ghost">
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

      {addOpen && (
        <AddEnrolmentModal
          courses={courses} students={students}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); reload() }}
        />
      )}
    </Layout>
  )
}

function AddEnrolmentModal({ courses, students, onClose, onSaved }) {
  const toast = useToast()
  const [userId, setUserId] = useState(students[0]?.$id || '')
  const [courseId, setCourseId] = useState(courses[0]?.$id || '')
  const [status, setStatus] = useState('active')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e?.preventDefault()
    if (!userId || !courseId) return toast.error('Pick a student and a course.')
    setBusy(true)
    try {
      await backend.enrol({ userId, courseId, status })
      toast.success('Student enrolled.')
      onSaved()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Enrol a student" onClose={onClose} width={520}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Enrol'}</button>
        </>
      }>
      {students.length === 0 || courses.length === 0 ? (
        <div className="muted small">You need at least one student and one course first.</div>
      ) : (
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="es">Student</label>
            <select id="es" value={userId} onChange={(e) => setUserId(e.target.value)}>
              {students.map((s) => <option key={s.$id} value={s.$id}>{s.name} — {s.email}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ec">Course</label>
            <select id="ec" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.$id} value={c.$id}>{c.title} ({c.code})</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="est">Status</label>
            <select id="est" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active — can access the course now</option>
              <option value="pending">Pending — awaiting approval</option>
              <option value="suspended">Suspended — no access</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </form>
      )}
    </Modal>
  )
}
