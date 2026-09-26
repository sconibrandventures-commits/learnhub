import { Link } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAuth } from '../../state/AuthContext'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, ProgressBar, StatusBadge } from '../../components/ui'
import { classWindow, countdownText, formatDateTime, timeAgo, truncate } from '../../lib/helpers'

export default function CourseHome() {
  const { course } = useCourse()
  const { user } = useAuth()
  useTicker(30000)

  const { data, loading } = useAsync(async () => {
    const [classes, announcements, assignments, assessments, recordings] = await Promise.all([
      backend.listClasses(course.$id),
      backend.listAnnouncements(course.$id),
      backend.listAssignments(course.$id),
      backend.listAssessments(course.$id),
      backend.listRecordings(course.$id),
    ])
    return { classes, announcements, assignments, assessments, recordings }
  }, [course.$id])

  if (loading) return <Spinner />

  const now = Date.now()
  const upcoming = (data.classes || [])
    .filter((c) => !classWindow(c, now).hasEnded && c.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const nextClass = upcoming[0]
  const live = (data.classes || []).find((c) => classWindow(c, now).canJoin)

  const openAssessments = (data.assessments || []).filter((a) => a.isOpen)
  const dueAssignments = (data.assignments || []).filter((a) => a.isPublished)

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>{course.title}</h1>
        <div className="muted small">
          {course.code} · taught by {course.instructor?.name || 'Unassigned'} · pass mark {course.passMark}%
        </div>
      </div>

      {/* Next class */}
      <div className="card">
        <div className="card__head">
          <h3><Icon name="video" size={16} /> Next live class</h3>
          <Link className="btn btn--sm" to="classes">Full schedule <Icon name="right" size={14} /></Link>
        </div>
        <div className="card__body">
          {live ? (
            <div className="row row--between">
              <div className="row" style={{ gap: 14 }}>
                <span style={{ color: 'var(--danger)' }}><Icon name="video" size={26} /></span>
                <div>
                  <div className="b">{live.title}</div>
                  <div className="small muted">{countdownText(live)} · {live.durationMinutes} minutes</div>
                </div>
              </div>
              <Link className="btn btn--join" to={`/courses/${course.slug}/classes/${live.$id}/join`}>
                <Icon name="play" size={15} /> Join class now
              </Link>
            </div>
          ) : nextClass ? (
            <div className="row row--between">
              <div className="row" style={{ gap: 14 }}>
                <span className="muted"><Icon name="calendar" size={26} /></span>
                <div>
                  <div className="b">{nextClass.title}</div>
                  <div className="small muted">{formatDateTime(nextClass.startsAt)} · {countdownText(nextClass)}</div>
                </div>
              </div>
              <Badge tone={classWindow(nextClass, now).canJoin ? 'live' : 'info'}>
                {classWindow(nextClass, now).canJoin ? 'Opens 15 min before' : timeAgo(nextClass.startsAt)}
              </Badge>
            </div>
          ) : (
            <div className="muted small">No upcoming classes have been scheduled yet.</div>
          )}
        </div>
      </div>

      <div className="grid grid--2">
        {/* To do */}
        <div className="card">
          <div className="card__head">
            <h3><Icon name="clipboard" size={16} /> To do</h3>
            <Link className="btn btn--sm" to="assignments">All <Icon name="right" size={14} /></Link>
          </div>
          <div className="card__body">
            {dueAssignments.length === 0 && openAssessments.length === 0 ? (
              <div className="muted small">Nothing outstanding. You're all caught up.</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {dueAssignments.map((a) => (
                  <Link key={a.$id} to="assignments" className="row row--between" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="row" style={{ gap: 10 }}>
                      <Icon name="clipboard" size={16} />
                      <div>
                        <div className="b small">{a.title}</div>
                        <div className="tiny muted">Due {a.dueAt ? timeAgo(a.dueAt) : 'no deadline'} · {a.maxScore} marks</div>
                      </div>
                    </div>
                    <Icon name="right" size={15} />
                  </Link>
                ))}
                {openAssessments.map((a) => (
                  <Link key={a.$id} to="assessments" className="row row--between" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="row" style={{ gap: 10 }}>
                      <Icon name="quiz" size={16} />
                      <div>
                        <div className="b small">{a.title}</div>
                        <div className="tiny muted">{a.type} · {a.durationMinutes} min · {a.myAttempts}/{a.maxAttempts} attempts used</div>
                      </div>
                    </div>
                    <Icon name="right" size={15} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="card">
          <div className="card__head">
            <h3><Icon name="bell" size={16} /> Announcements</h3>
            <Link className="btn btn--sm" to="announcements">All <Icon name="right" size={14} /></Link>
          </div>
          <div className="card__body">
            {(data.announcements || []).length === 0 ? (
              <div className="muted small">No announcements yet.</div>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                {(data.announcements || []).slice(0, 3).map((a) => (
                  <div key={a.$id}>
                    <div className="row row--between">
                      <div className="b small">
                        {a.isPinned && <Badge tone="warn">Pinned</Badge>} {a.title}
                      </div>
                      <span className="tiny muted">{timeAgo(a.publishedAt)}</span>
                    </div>
                    <div className="small muted">{truncate(a.body, 150)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent recordings */}
      <div className="card">
        <div className="card__head">
          <h3><Icon name="play" size={16} /> Recently added recordings</h3>
          <Link className="btn btn--sm" to="recordings">All <Icon name="right" size={14} /></Link>
        </div>
        <div className="card__body">
          {(data.recordings || []).length === 0 ? (
            <div className="muted small">No recordings published yet. They'll appear here after each class.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {(data.recordings || []).slice(0, 3).map((r) => (
                <Link key={r.$id} to="recordings" className="row row--between" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ color: 'var(--brand)' }}><Icon name="play" size={16} /></span>
                    <div>
                      <div className="b small">{r.title}</div>
                      <div className="tiny muted">{formatDateTime(r.recordedAt)}{r.durationMinutes ? ` · ${r.durationMinutes} min` : ''}</div>
                    </div>
                  </div>
                  <Icon name="right" size={15} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
