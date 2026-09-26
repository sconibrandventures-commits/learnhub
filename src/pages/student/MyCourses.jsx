import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Badge, Spinner, Empty, PageHead, ProgressBar, StatusBadge } from '../../components/ui'
import { classWindow, countdownText, formatDateTime, timeAgo } from '../../lib/helpers'

export default function MyCourses() {
  const { user } = useAuth()
  const toast = useToast()
  useTicker(30000) // keep countdowns fresh

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const { data, loading, reload } = useAsync(async () => {
    const courseIds = await backend.myCourseIds()
    const [courses, enrolments] = await Promise.all([
      backend.listCourses(),
      backend.listEnrolments({ userId: user.$id }),
    ])
    const mine = courses.filter((c) => courseIds.includes(c.$id))

    // Next class for each of my courses
    const withNext = await Promise.all(
      mine.map(async (c) => {
        const classes = await backend.listClasses(c.$id)
        const now = Date.now()
        const joinable = classes.filter((cl) => classWindow(cl, now).canJoin)
        const upcoming = classes
          .filter((cl) => !classWindow(cl, now).hasEnded && cl.status !== 'cancelled')
          .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        return {
          course: c,
          classes,
          liveNow: joinable[0] || null,
          nextUp: upcoming[0] || null,
          enrolment: enrolments.find((e) => e.courseId === c.$id) || null,
        }
      })
    )
    return { rows: withNext, allCourses: courses }
  }, [user.$id])

  const rows = data?.rows || []
  const liveNow = rows.find((r) => r.liveNow)
  const nextUp = rows
    .map((r) => r.nextUp && !r.liveNow ? { cls: r.nextUp, course: r.course } : null)
    .filter(Boolean)
    .sort((a, b) => new Date(a.cls.startsAt) - new Date(b.cls.startsAt))[0]

  async function joinWithCode(e) {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    try {
      await backend.joinWithCode(code.trim())
      toast.success('You are now enrolled. Welcome to the course!')
      setCode('')
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <Layout title="My courses"><Spinner label="Loading your courses…" /></Layout>

  return (
    <Layout title="My courses">
      <PageHead
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        subtitle={rows.length ? `You are registered for ${rows.length} course${rows.length === 1 ? '' : 's'}.` : "You aren't registered for any courses yet."}
      />

      {/* Live / next class banner */}
      {liveNow?.liveNow && (
        <div className="banner">
          <div className="banner__text">
            <h3>
              <span className="dot pulse" style={{ marginRight: 8 }} />
              {liveNow.course.title} — classroom is open
            </h3>
            <p>{liveNow.liveNow.title} · {countdownText(liveNow.liveNow)}</p>
          </div>
          <Link className="btn btn--lg" style={{ background: '#fff', color: '#b91c1c', borderColor: 'transparent' }}
            to={`/courses/${liveNow.course.slug}/classes/${liveNow.liveNow.$id}/join`}>
            <Icon name="play" size={16} /> Join class now
          </Link>
        </div>
      )}

      {!liveNow && nextUp && (
        <div className="banner banner--upcoming">
          <div className="banner__text">
            <h3>Next class: {nextUp.course.title}</h3>
            <p>{nextUp.cls.title} · {countdownText(nextUp.cls)} · {formatDateTime(nextUp.cls.startsAt)}</p>
          </div>
          <Link className="btn" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }}
            to={`/courses/${nextUp.course.slug}/classes`}>
            View schedule <Icon name="right" size={15} />
          </Link>
        </div>
      )}

      <div className="grid grid--2 mb-3">
        {/* Course list */}
        <div style={{ gridColumn: '1 / -1' }}>
          {rows.length === 0 ? (
            <div className="card">
              <Empty icon="book" title="No courses yet"
                action={<Link className="btn btn--primary" to="/student/catalog">Browse the catalogue</Link>}>
                Ask your instructor for an enrolment code, or browse the catalogue to see what's available.
              </Empty>
            </div>
          ) : (
            <div className="grid grid--3">
              {rows.map(({ course, classes, liveNow: live, nextUp: next, enrolment }) => (
                <div className="course-card" key={course.$id}>
                  <div className="course-card__top" />
                  <div className="course-card__body">
                    <div className="row row--between mb-1">
                      <h3>{course.title}</h3>
                      {live && <Badge tone="live"><span className="dot pulse" />Live</Badge>}
                    </div>
                    <div className="course-card__meta">
                      {course.code} · {course.instructor?.name || 'Unassigned'}
                    </div>
                    <p className="course-card__desc">{course.description}</p>

                    <div className="row tiny muted mb-2" style={{ gap: 14 }}>
                      <span><Icon name="video" size={13} /> {classes.length} classes</span>
                      <span><Icon name="clock" size={13} /> {next ? timeAgo(next.startsAt) : '—'}</span>
                    </div>

                    {enrolment && enrolment.status !== 'active' && (
                      <div className="mb-2"><StatusBadge status={enrolment.status} /></div>
                    )}

                    <div className="course-card__foot">
                      <Link className="btn btn--primary" style={{ flex: 1 }} to={`/courses/${course.slug}`}>
                        Open course
                      </Link>
                      {live ? (
                        <Link className="btn btn--join" to={`/courses/${course.slug}/classes/${live.$id}/join`}>
                          <Icon name="play" size={14} /> Join
                        </Link>
                      ) : (
                        <Link className="btn" to={`/courses/${course.slug}/classes`}>
                          <Icon name="calendar" size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join with a code */}
        <div className="card">
          <div className="card__head"><h3><Icon name="key" size={16} /> Join a course</h3></div>
          <div className="card__body">
            <p className="small muted">Got an enrolment code from your instructor? Enter it below to join that course.</p>
            <form onSubmit={joinWithCode} className="row">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WEB-101" style={{ flex: 1, minWidth: 130 }} />
              <button className="btn btn--primary" disabled={joining || !code.trim()}>
                {joining ? 'Joining…' : 'Join'}
              </button>
            </form>
          </div>
        </div>

        {/* Quick links */}
        <div className="card">
          <div className="card__head"><h3><Icon name="right" size={16} /> Jump to</h3></div>
          <div className="card__body stack" style={{ gap: 8 }}>
            <Link className="btn btn--outline" to="/student/catalog">
              <Icon name="search" size={15} /> Browse all courses
            </Link>
            <Link className="btn btn--outline" to="/profile">
              <Icon name="cog" size={15} /> My profile & password
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}
