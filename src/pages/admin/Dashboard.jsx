import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Badge, Stat, PageHead, Alert } from '../../components/ui'
import { formatDateTime, countdownText, classWindow } from '../../lib/helpers'

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
