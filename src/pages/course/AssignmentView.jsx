import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge, ProgressBar } from '../../components/ui'
import { formatDateTime, timeAgo } from '../../lib/helpers'

export default function AssignmentView() {
  const { course } = useCourse()
  const { assignmentId } = useParams()
  const toast = useToast()

  const [body, setBody] = useState('')
  const [fileName, setFileName] = useState(null)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)

  const { data, loading, error, reload } = useAsync(async () => {
    const assignment = await backend.getAssignment(assignmentId)
    if (assignment.courseId !== course.$id) throw new Error('That assignment does not belong to this course.')
    const submission = await backend.mySubmission(assignmentId)
    setBody(submission?.body || '')
    setFileName(submission?.fileName || null)
    return { assignment, submission }
  }, [assignmentId, course.$id])

  async function submit(e) {
    e.preventDefault()
    if (!body.trim() && !fileName) return toast.error('Write an answer or attach a file first.')
    setBusy(true)
    try {
      await backend.submitAssignment(assignmentId, { body, fileName })
      toast.success('Your work has been submitted.')
      setTouched(false)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <Alert tone="danger">{error.message}</Alert>

  const { assignment, submission } = data
  const late = assignment.dueAt && new Date(assignment.dueAt).getTime() < Date.now()
  const locked = submission?.status === 'returned'

  return (
    <div className="stack">
      <div>
        <Link className="btn btn--ghost btn--sm" to={`/courses/${course.slug}/assignments`}>‹ Back to assignments</Link>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 style={{ flex: 1 }}>{assignment.title}</h2>
          {submission?.status === 'submitted' && <Badge tone="info">Submitted</Badge>}
          {submission?.status === 'graded' && <Badge tone="ok">Graded</Badge>}
          {submission?.status === 'returned' && <Badge tone="ok">Returned</Badge>}
          {!submission && <Badge tone={late ? 'danger' : 'warn'}>{late ? 'Overdue' : 'Not submitted'}</Badge>}
        </div>
        <div className="card__body">
          <div className="row small muted mb-2" style={{ gap: 18 }}>
            <span><Icon name="clock" size={14} /> {assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)}` : 'No deadline'}</span>
            <span><Icon name="star" size={14} /> {assignment.maxScore} marks</span>
            {assignment.dueAt && <span>{timeAgo(assignment.dueAt)}</span>}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{assignment.description}</div>
        </div>
      </div>

      {/* Result */}
      {submission && (submission.score !== null || submission.feedback) && (
        <div className="card">
          <div className="card__head"><h3><Icon name="check" size={16} /> Your result</h3></div>
          <div className="card__body">
            {submission.score !== null && (
              <div className="mb-2" style={{ maxWidth: 320 }}>
                <div className="row row--between mb-1">
                  <span className="b">{submission.score} / {assignment.maxScore}</span>
                  <span className="muted small">{Math.round((submission.score / assignment.maxScore) * 100)}%</span>
                </div>
                <ProgressBar value={(submission.score / assignment.maxScore) * 100} />
              </div>
            )}
            {submission.feedback ? (
              <div className="alert alert--info" style={{ display: 'block' }}>
                <b>Feedback from your instructor</b>
                <div style={{ whiteSpace: 'pre-wrap' }}>{submission.feedback}</div>
              </div>
            ) : (
              <div className="muted small">No written feedback yet.</div>
            )}
            {submission.submittedAt && (
              <div className="tiny muted mt-2">Submitted {formatDateTime(submission.submittedAt)}</div>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="card">
        <div className="card__head">
          <h3><Icon name="clipboard" size={16} /> {submission ? 'Your submission' : 'Submit your work'}</h3>
          {submission && submission.status !== 'returned' && <Badge tone="ok">You can still edit this</Badge>}
        </div>
        <div className="card__body">
          {locked ? (
            <Alert tone="info" title="This assignment has been graded and returned">
              Your submission is locked. If you think this is a mistake, message your instructor.
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="answer">Your answer</label>
                <textarea
                  id="answer" value={body}
                  onChange={(e) => { setBody(e.target.value); setTouched(true) }}
                  placeholder="Type your answer, or paste your code here…"
                  style={{ minHeight: 170, fontFamily: 'var(--mono)', fontSize: '.86rem' }}
                />
                <div className="hint">You can come back and edit this until it has been graded.</div>
              </div>

              <div className="field">
                <label htmlFor="file">Attach a file {submission?.fileName && <span className="muted">(current: {submission.fileName})</span>}</label>
                <input id="file" type="file" onChange={(e) => { setFileName(e.target.files?.[0]?.name || null); setTouched(true) }} />
                <div className="hint">Optional — up to one file.</div>
              </div>

              <div className="row">
                <button className="btn btn--primary" disabled={busy || (!touched && !submission)}>
                  {busy ? 'Submitting…' : submission ? 'Update submission' : 'Submit assignment'}
                </button>
                {late && !submission && <span className="badge badge--danger">This is past the deadline</span>}
              </div>
            </form>
          )}

          {locked && submission && (
            <div className="mt-2">
              <div className="stat__label mb-1">What you submitted</div>
              <pre style={{
                background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                padding: 14, overflowX: 'auto', fontSize: '.82rem', margin: 0,
              }}>{submission.body || '(no written answer)'}</pre>
              {submission.fileName && <div className="small muted mt-1"><Icon name="download" size={13} /> {submission.fileName}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
