import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Badge, Stat, PageHead, Alert } from '../../components/ui'
import { formatDateTime, countdownText, classWindow } from '../../lib/helpers'

function EmailServiceCard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/.netlify/functions/notify')
      .then((res) => res.json())
      .then((data) => {
        setStatus(data)
        setLoading(false)
      })
      .catch(() => {
        setStatus({ status: 'offline', provider: 'unknown', notice: 'Notification function not deployed or unreachable.' })
        setLoading(false)
      })
  }, [])

  async function handleSendTest(e) {
    e?.preventDefault()
    if (!testEmail.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/.netlify/functions/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', email: testEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setResult({
          success: true,
          message: `Test email sent to ${testEmail}! Check your inbox (and spam folder).`,
        })
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send test email.',
        })
      }
    } catch (err) {
      setResult({ success: false, message: err.message })
    } finally {
      setSending(false)
    }
  }

  if (loading) return null

  return (
    <div className="card mb-3">
      <div className="card__head">
        <h3><Icon name="mail" size={16} /> Email Notification Service</h3>
        {status?.hasSmtp ? (
          <Badge tone="ok">● {status.provider} Connected</Badge>
        ) : status?.hasResendApiKey ? (
          <Badge tone="ok">● Resend Connected ({status.resendKeyPrefix})</Badge>
        ) : (
          <Badge tone="warn">⚠️ Simulation Mode (No Key)</Badge>
        )}
      </div>
      <div className="card__body">
        <div className="small muted mb-2">
          {status?.notice}
        </div>
        <div className="row small muted mb-3" style={{ gap: 20 }}>
          <div><b>Provider:</b> {status?.provider || 'None'}</div>
          <div><b>From Address:</b> <code>{status?.emailFrom || 'default'}</code></div>
        </div>

        <form onSubmit={handleSendTest} className="row" style={{ gap: 10, maxWidth: 540 }}>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter an email to test live delivery…"
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn--sm btn--primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send test email'}
          </button>
        </form>

        {result && (
          <div className={`alert alert--${result.success ? 'ok' : 'danger'} mt-2`}>
            <Icon name={result.success ? 'check' : 'alert'} size={16} />
            <div>{result.message}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  useTicker(60000)

  const { data, loading } = useAsync(async () => {
    const [users, courses] = await Promise.all([backend.listUsers(), backend.listCourses()])
    const enrolments = await backend.listEnrolments()

    let classes = []
    for (const c of courses) {
      const cls = await backend.listClasses(c.$id)
      classes.push(...cls.map((x) => ({ ...x, course: c })))
    }

    const now = Date.now()
    return {
      users, courses, enrolments, classes,
      students: users.filter((u) => u.role === 'student'),
      instructors: users.filter((u) => u.role === 'instructor'),
      pending: enrolments.filter((e) => e.status === 'pending'),
      active: enrolments.filter((e) => e.status === 'active'),
      upcoming: classes
        .filter((c) => !classWindow(c, now).hasEnded && c.status !== 'cancelled')
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        .slice(0, 6),
    }
  }, [])

  if (loading) return <Layout title="Admin dashboard"><Spinner /></Layout>

  return (
    <Layout title="Admin dashboard">
      <PageHead title="Portal overview" subtitle="Everything happening across LearnHub.">
        <Link className="btn" to="/admin/users"><Icon name="users" size={15} /> Users</Link>
        <Link className="btn btn--primary" to="/admin/enrolments"><Icon name="key" size={15} /> Enrolments</Link>
      </PageHead>

      <div className="grid grid--4 mb-3">
        <Stat label="Students" value={data.students.length} hint="registered accounts" variant="brand" />
        <Stat label="Instructors" value={data.instructors.length} hint="teaching staff" />
        <Stat label="Courses" value={data.courses.length} hint={`${data.active.length} active enrolments`} />
        <Stat label="Pending" value={data.pending.length} hint="awaiting approval" />
      </div>

      <EmailServiceCard />

      {data.pending.length > 0 && (
        <div className="mb-3">
          <Alert tone="warn" title={`${data.pending.length} enrolment request(s) waiting`}>
            <Link to="/admin/enrolments">Review them now →</Link>
          </Alert>
        </div>
      )}

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><h3><Icon name="calendar" size={16} /> Upcoming classes</h3></div>
          {data.upcoming.length === 0 ? (
            <div className="card__body muted small">No classes scheduled.</div>
          ) : (
            data.upcoming.map((c) => (
              <div className="class-row" key={c.$id}>
                <div className="class-row__main">
                  <h4>{c.title}</h4>
                  <div className="meta">{c.course.title} · {formatDateTime(c.startsAt)} · {countdownText(c)}</div>
                </div>
                <Badge tone={classWindow(c).canJoin ? 'live' : 'info'}>
                  {classWindow(c).canJoin ? 'Live' : 'Scheduled'}
                </Badge>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card__head">
            <h3><Icon name="book" size={16} /> Courses</h3>
            <Link className="btn btn--sm" to="/admin/courses">Manage <Icon name="right" size={14} /></Link>
          </div>
          {data.courses.length === 0 ? (
            <div className="card__body muted small">No courses yet.</div>
          ) : (
            data.courses.map((c) => {
              const n = data.enrolments.filter((e) => e.courseId === c.$id && e.status === 'active').length
              return (
                <div className="class-row" key={c.$id}>
                  <div className="class-row__main">
                    <h4>{c.title}</h4>
                    <div className="meta">{c.code} · {c.instructor?.name || 'no instructor'} · {n} students</div>
                  </div>
                  <Link className="btn btn--sm" to={`/instructor/courses/${c.$id}`}>Manage</Link>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}
