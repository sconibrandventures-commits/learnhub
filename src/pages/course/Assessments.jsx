import { Link } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge } from '../../components/ui'
import { formatDateTime, assessmentAvailability } from '../../lib/helpers'

export default function Assessments() {
  const { course } = useCourse()
  useTicker(30000)

  const { data, loading } = useAsync(async () => {
    return backend.listAssessments(course.$id)
  }, [course.$id])

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Tests &amp; exams</h1>
        <div className="muted small">Timed assessments. Once you start, the clock keeps running.</div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty icon="quiz" title="No tests or exams yet">Your instructor hasn't published any assessments for this course.</Empty></div>
      ) : (
        <div className="grid grid--2">
          {rows.map((a) => {
            const avail = assessmentAvailability(a)
            const exhausted = a.myAttempts >= a.maxAttempts
            return (
              <div className="card" key={a.$id}>
                <div className="card__head">
                  <h3 style={{ flex: 1 }}>{a.title}</h3>
                  <Badge tone={a.type === 'exam' ? 'danger' : 'brand'}>{a.type}</Badge>
                </div>
                <div className="card__body">
                  <div className="row small muted mb-2" style={{ gap: 14, flexWrap: 'wrap' }}>
                    <span><Icon name="quiz" size={13} /> {a.questionCount || 0} questions</span>
                    <span><Icon name="clock" size={13} /> {a.durationMinutes} min</span>
                    <span><Icon name="star" size={13} /> {a.totalMarks || 0} marks</span>
                    <span>Pass {a.passMark}%</span>
                  </div>

                  <div className="row small muted mb-2" style={{ gap: 14 }}>
                    <span>Attempts: {a.myAttempts}/{a.maxAttempts}</span>
                    {a.myBest > 0 && <span>Best: <b>{a.myBest}%</b></span>}
                  </div>

                  {a.startsAt && <div className="tiny muted">Opens {formatDateTime(a.startsAt)}</div>}
                  {a.endsAt && <div className="tiny muted">Closes {formatDateTime(a.endsAt)}</div>}

                  <div className="row mt-2">
                    {!a.isPublished ? (
                      <button className="btn" disabled>Not published</button>
                    ) : !avail.open ? (
                      <button className="btn" disabled>{avail.reason}</button>
                    ) : exhausted ? (
                      <button className="btn" disabled>No attempts left</button>
                    ) : (
                      <Link className="btn btn--primary" to={`/courses/${course.slug}/assessments/${a.$id}`}>
                        {a.myAttempts > 0 ? 'Try again' : 'Start'} <Icon name="right" size={15} />
                      </Link>
                    )}
                    {a.myAttempts > 0 && (
                      <Link className="btn btn--sm" to={`/courses/${course.slug}/assessments/${a.$id}/history`}>
                        My results
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
