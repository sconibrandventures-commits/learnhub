import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge } from '../../components/ui'
import { formatDateTime, assessmentAvailability } from '../../lib/helpers'

export default function AssessmentStart() {
  const { course } = useCourse()
  const { assessmentId } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const { data, loading, error } = useAsync(async () => {
    const assessment = await backend.getAssessment(assessmentId)
    if (assessment.courseId !== course.$id) throw new Error('That assessment does not belong to this course.')
    const attempts = await backend.listAttempts(assessmentId)
    return { assessment, attempts }
  }, [assessmentId, course.$id])

  async function start() {
    setBusy(true)
    try {
      const attempt = await backend.startAttempt(assessmentId)
      navigate(`/courses/${course.slug}/assessments/${assessmentId}/take/${attempt.$id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <Alert tone="danger">{error.message}</Alert>

  const { assessment, attempts } = data
  const mine = attempts.filter((a) => a.userId === undefined || true) // listAttempts returns all for instructor; filtered below by best
  const avail = assessmentAvailability(assessment)
  const canStart = avail.open && assessment.myAttempts < assessment.maxAttempts

  return (
    <div className="stack">
      <div>
        <Link className="btn btn--ghost btn--sm" to={`/courses/${course.slug}/assessments`}>‹ Back to tests &amp; exams</Link>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 style={{ flex: 1 }}>{assessment.title}</h2>
          <Badge tone={assessment.type === 'exam' ? 'danger' : 'brand'}>{assessment.type}</Badge>
        </div>
        <div className="card__body">
          <div className="grid grid--4 mb-3">
            <div className="stat">
              <div className="stat__label">Questions</div>
              <div className="stat__value">{assessment.questions.length}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Time limit</div>
              <div className="stat__value">{assessment.durationMinutes}<small style={{ fontSize: '.9rem' }}> min</small></div>
            </div>
            <div className="stat">
              <div className="stat__label">Total marks</div>
              <div className="stat__value">{assessment.totalMarks || 0}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Pass mark</div>
              <div className="stat__value">{assessment.passMark}<small style={{ fontSize: '.9rem' }}>%</small></div>
            </div>
          </div>

          {assessment.instructions && (
            <div className="alert alert--info" style={{ display: 'block' }}>
              <b>Instructions</b>
              <div style={{ whiteSpace: 'pre-wrap' }}>{assessment.instructions}</div>
            </div>
          )}

          <div className="row small muted mt-2" style={{ gap: 16 }}>
            <span>Attempts allowed: <b>{assessment.maxAttempts}</b></span>
            <span>Used: <b>{assessment.myAttempts}</b></span>
            {assessment.shuffleQuestions && <span>Questions are shuffled</span>}
            <span>Results shown: <b>{assessment.showResults ? 'immediately' : 'after review'}</b></span>
          </div>

          {assessment.startsAt && <div className="tiny muted mt-1">Opens {formatDateTime(assessment.startsAt)}</div>}
          {assessment.endsAt && <div className="tiny muted">Closes {formatDateTime(assessment.endsAt)}</div>}

          <hr />

          {!avail.open ? (
            <Alert tone="warn" title="Not available">{avail.reason}</Alert>
          ) : assessment.myAttempts >= assessment.maxAttempts ? (
            <Alert tone="info" title="No attempts remaining">
              You have used all {assessment.maxAttempts} attempt(s) for this assessment.
            </Alert>
          ) : (
            <div className="row">
              <button className="btn btn--primary btn--lg" onClick={start} disabled={busy}>
                <Icon name="play" size={17} /> {busy ? 'Starting…' : assessment.myAttempts > 0 ? `Start attempt ${assessment.myAttempts + 1}` : 'Start now'}
              </button>
              <span className="muted small">
                Once you start, the timer runs for {assessment.durationMinutes} minutes and cannot be paused.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
