import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, ProgressBar, StatusBadge, ConfirmButton } from '../../../components/ui'
import { formatDate, formatDateTime } from '../../../lib/helpers'

export default function PeopleTab({ course }) {
  const [view, setView] = useState('students')
  return (
    <div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={view === 'students' ? 'active' : ''} onClick={() => setView('students')}>
          <Icon name="users" size={15} /> Students
        </button>
        <button className={view === 'gradebook' ? 'active' : ''} onClick={() => setView('gradebook')}>
          <Icon name="chart" size={15} /> Gradebook
        </button>
      </div>
      {view === 'students' ? <Students course={course} /> : <Gradebook course={course} />}
    </div>
  )
}

function Students({ course }) {
  const toast = useToast()
  const [busy, setBusy] = useState(null)

  const { data, loading, reload } = useAsync(async () => {
    const [enrolments, classes] = await Promise.all([
      backend.listEnrolments({ courseId: course.$id }),
      backend.listClasses(course.$id),
    ])
    const ended = classes.filter((c) => c.status === 'ended')
    const rows = await Promise.all(
      enrolments.map(async (e) => {
        let attended = 0
        for (const c of ended) {
          const a = await backend.listAttendance(c.$id)
          if (a.some((x) => x.userId === e.userId)) attended++
        }
        return { ...e, attended, totalEnded: ended.length }
      })
    )
    return rows.sort((a, b) => (b.status === 'active') - (a.status === 'active'))
  }, [course.$id])

  async function setStatus(e, status) {
    setBusy(e.$id)
    try {
      await backend.setEnrolmentStatus(e.$id, status)
      toast.success(`${e.user?.name || 'Student'} — ${status}.`)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(null) }
  }

  async function remove(e) {
    setBusy(e.$id)
    try { await backend.removeEnrolment(e.$id); toast.success('Removed from course.'); reload() }
    catch (err) { toast.error(err.message) } finally { setBusy(null) }
  }

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div className="card">
      {rows.length === 0 ? (
        <Empty icon="users" title="No students yet">
          Nobody has enrolled in this course yet. Share the code <span className="mono b">{course.code}</span> with your students.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Status</th><th>Joined</th>
                <th className="num">Attendance</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.$id}>
                  <td>
                    <div className="b">{e.user?.name || 'Unknown'}</div>
                    <div className="tiny muted">{e.user?.email}</div>
                  </td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="small muted">{e.enrolledAt ? formatDate(e.enrolledAt) : '—'}</td>
                  <td className="num">
                    {e.totalEnded > 0 ? `${e.attended}/${e.totalEnded}` : '—'}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {e.status !== 'active' ? (
                        <button className="btn btn--sm btn--ok" disabled={busy === e.$id} onClick={() => setStatus(e, 'active')}>
                          Approve / Activate
                        </button>
                      ) : (
                        <button className="btn btn--sm" disabled={busy === e.$id} onClick={() => setStatus(e, 'suspended')}>
                          Suspend
                        </button>
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
      <div className="card__foot small muted">
        Suspending a student hides the whole course from them immediately — including the live class link.
      </div>
    </div>
  )
}

function Gradebook({ course }) {
  const { data, loading } = useAsync(async () => {
    const [enrolments, assignments, assessments] = await Promise.all([
      backend.listEnrolments({ courseId: course.$id }),
      backend.listAssignments(course.$id),
      backend.listAssessments(course.$id),
    ])
    const students = enrolments.filter((e) => e.status === 'active')

    const assignmentSubs = {}
    for (const a of assignments) {
      const subs = await backend.listSubmissions(a.$id)
      assignmentSubs[a.$id] = subs
    }
    const assessmentAttempts = {}
    for (const t of assessments) {
      const attempts = await backend.listAttempts(t.$id)
      assessmentAttempts[t.$id] = attempts
    }
    return { students, assignments, assessments, assignmentSubs, assessmentAttempts }
  }, [course.$id])

  if (loading) return <Spinner />

  const { students, assignments, assessments, assignmentSubs, assessmentAttempts } = data

  const overall = students.map((s) => {
    const pcts = []
    assignments.forEach((a) => {
      const sub = (assignmentSubs[a.$id] || []).find((x) => x.userId === s.userId)
      if (sub?.score !== null && sub?.score !== undefined) pcts.push((sub.score / a.maxScore) * 100)
    })
    assessments.forEach((t) => {
      const mine = (assessmentAttempts[t.$id] || []).filter((x) => x.userId === s.userId && x.status !== 'in_progress')
      const best = mine.reduce((m, x) => Math.max(m, x.percentage || 0), 0)
      if (mine.length) pcts.push(best)
    })
    return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null
  })

  return (
    <div className="card">
      {students.length === 0 ? (
        <Empty icon="chart" title="No enrolled students">Once students enrol and start submitting work, their marks appear here.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Student</th>
                {assignments.map((a) => <th key={a.$id} className="num">{a.title}</th>)}
                {assessments.map((t) => <th key={t.$id} className="num">{t.title}</th>)}
                <th className="num">Overall</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.$id}>
                  <td>
                    <div className="b">{s.user?.name || 'Unknown'}</div>
                    <div className="tiny muted">{s.user?.email}</div>
                  </td>
                  {assignments.map((a) => {
                    const sub = (assignmentSubs[a.$id] || []).find((x) => x.userId === s.userId)
                    return (
                      <td key={a.$id} className="num">
                        {sub?.score !== null && sub?.score !== undefined
                          ? <span className="b">{sub.score}<span className="muted">/{a.maxScore}</span></span>
                          : sub ? <Badge tone="info">Submitted</Badge> : <span className="muted">—</span>}
                      </td>
                    )
                  })}
                  {assessments.map((t) => {
                    const mine = (assessmentAttempts[t.$id] || []).filter((x) => x.userId === s.userId && x.status !== 'in_progress')
                    const best = mine.reduce((m, x) => (x.percentage > (m?.percentage ?? -1) ? x : m), null)
                    return (
                      <td key={t.$id} className="num">
                        {best
                          ? <span className="b" style={{ color: best.passed ? 'var(--ok)' : 'var(--danger)' }}>{best.percentage}%</span>
                          : <span className="muted">—</span>}
                      </td>
                    )
                  })}
                  <td className="num">
                    {overall[i] === null ? <span className="muted">—</span> : (
                      <div>
                        <div className="b">{overall[i]}%</div>
                        <ProgressBar value={overall[i]} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card__foot small muted">
        Best attempt is used for each assessment. Written answers must be marked before they count.
      </div>
    </div>
  )
}
