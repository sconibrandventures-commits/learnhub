import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, Stat, PageHead } from '../../components/ui'
import { classWindow, countdownText, formatDateTime, timeAgo } from '../../lib/helpers'

export default function InstructorDashboard() {
  const { user } = useAuth()
  useTicker(30000)

  const { data, loading } = useAsync(async () => {
    const [courses, allUsers] = await Promise.all([backend.listCourses(), backend.listUsers()])
    const mine = courses.filter((c) => c.instructorId === user.$id)

    let totalStudents = 0
    let classes = []
    let pending = 0
    const perCourse = []

    for (const c of mine) {
      const [enrolments, cls, assignments] = await Promise.all([
        backend.listEnrolments({ courseId: c.$id }),
        backend.listClasses(c.$id),
        backend.listAssignments(c.$id),
      ])
      const active = enrolments.filter((e) => e.status === 'active')
      totalStudents += active.length

      let coursePending = 0
      for (const a of assignments) {
        const subs = await backend.listSubmissions(a.$id)
        coursePending += subs.filter((s) => s.status === 'submitted').length
      }
      pending += coursePending

      classes.push(...cls.map((cl) => ({ ...cl, course: c })))
      perCourse.push({ course: c, students: active.length, classes: cls.length, pending: coursePending, enrolments })
    }

    const now = Date.now()
    const upcoming = classes
      .filter((c) => !classWindow(c, now).hasEnded && c.status !== 'cancelled')
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))

    return { courses: mine, perCourse, totalStudents, upcoming, pending, classes }
  }, [user.$id])

  if (loading) return <Layout title="Instructor dashboard"><Spinner /></Layout>

  const liveNow = (data?.upcoming || []).filter((c) => classWindow(c).canJoin)

  return (
    <Layout title="Instructor dashboard">
      <PageHead
        title={`Hello, ${user.name.split(' ')[0]}`}
        subtitle="Everything you need for your classes today."
      >
        <Link className="btn btn--primary" to="/instructor/courses"><Icon name="plus" size={15} /> New course</Link>
      </PageHead>

      <div className="grid grid--4 mb-3">
        <Stat label="Courses" value={data.courses.length} hint="assigned to you" variant="brand" />
        <Stat label="Students" value={data.totalStudents} hint="actively enrolled" />
        <Stat label="Classes" value={data.classes.length} hint={`${data.upcoming.length} upcoming`} />
        <Stat label="Needs grading" value={data.pending} hint={data.pending ? 'submissions waiting' : 'all caught up'} />
      </div>

      {liveNow.length > 0 && (
        <div className="banner">
          <div className="banner__text">
            <h3><span className="dot pulse" style={{ marginRight: 8 }} />{liveNow[0].course.title} — class is live</h3>
            <p>{liveNow[0].title} · {countdownText(liveNow[0])}</p>
          </div>
          <Link className="btn btn--lg" style={{ background: '#fff', color: '#b91c1c', borderColor: 'transparent' }}
            to={`/instructor/courses/${liveNow[0].course.$id}?tab=classes`}>
            <Icon name="video" size={16} /> Host panel
          </Link>
        </div>
      )}

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head">
            <h3><Icon name="calendar" size={16} /> Upcoming classes</h3>
          </div>
          {(data.upcoming || []).length === 0 ? (
            <div className="card__body muted small">No upcoming classes scheduled.</div>
          ) : (
            (data.upcoming || []).slice(0, 6).map((c) => (
              <div className="class-row" key={c.$id}>
                <div className="class-row__main">
                  <h4>{c.title}</h4>
                  <div className="meta">{c.course.title} · {formatDateTime(c.startsAt)} · {countdownText(c)}</div>
                </div>
                <Badge tone={classWindow(c).canJoin ? 'live' : 'info'}>
                  {classWindow(c).canJoin ? 'Joinable now' : timeAgo(c.startsAt)}
                </Badge>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card__head">
            <h3><Icon name="book" size={16} /> My courses</h3>
            <Link className="btn btn--sm" to="/instructor/courses">Manage <Icon name="right" size={14} /></Link>
          </div>
          {data.perCourse.length === 0 ? (
            <div className="card__body">
              <Empty icon="book" title="No courses yet"
                action={<Link className="btn btn--primary" to="/instructor/courses">Create your first course</Link>}>
                Create a course, then schedule classes and add content.
              </Empty>
            </div>
          ) : (
            data.perCourse.map(({ course, students, classes: n, pending: p }) => (
              <div className="class-row" key={course.$id}>
                <div className="class-row__main">
                  <h4><Link to={`/instructor/courses/${course.$id}`}>{course.title}</Link></h4>
                  <div className="meta">{students} students · {n} classes {p > 0 && <>· <span style={{ color: 'var(--warn)' }}>{p} to grade</span></>}</div>
                </div>
                <Link className="btn btn--sm" to={`/instructor/courses/${course.$id}`}>Open</Link>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}
