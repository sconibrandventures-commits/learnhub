import { Link, useParams } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge, ProgressBar } from '../../components/ui'
import { formatDateTime } from '../../lib/helpers'

export default function AssessmentResult() {
  const { course } = useCourse()
  const { assessmentId, attemptId } = useParams()

  const { data, loading, error } = useAsync(async () => {
    const [assessment, attempt] = await Promise.all([
      backend.getAssessment(assessmentId),
      backend.getAttempt(attemptId),
    ])
    return { assessment, attempt }
  }, [assessmentId, attemptId])

  if (loading) return <Spinner />
  if (error) return <Alert tone="danger">{error.message}</Alert>

  const { assessment, attempt } = data
  const passed = attempt.passed
  const pct = attempt.percentage || 0

  return (
    <div className="stack">
      <div>
        <Link className="btn btn--ghost btn--sm" to={`/courses/${course.slug}/assessments`}>‹ Back to tests &amp; exams</Link>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '26px 24px', textAlign: 'center',
          background: passed
            ? 'linear-gradient(135deg,#065f46,#059669 60%,#10b981)'
            : 'linear-gradient(135deg,#991b1b,#dc2626 60%,#f97316)',
          color: '#fff',
        }}>
          <div style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em', opacity: .9 }}>
            {assessment.title}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, margin: '6px 0' }}>
            {pct}%
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 650 }}>
            {passed ? 'Passed' : 'Not passed'} · {attempt.score} / {attempt.total} marks
          </div>
          <div style={{ fontSize: '.85rem', opacity: .9, marginTop: 4 }}>
            Pass mark {assessment.passMark}% · submitted {formatDateTime(attempt.submittedAt)}
          </div>
        </div>
        <div className="card__body">
          <ProgressBar value={pct} tone={passed ? 'ok' : 'danger'} />
          {attempt.status === 'needs_marking' && (
            <div className="mt-2">
              <Alert tone="warn" title="Waiting on your instructor">
                Some of your answers need to be marked by hand, so your score may still change.
              </Alert>
            </div>
          )}
        </div>
      </div>

      {assessment.showResults && (
        <div className="card">
          <div className="card__head"><h3><Icon name="check" size={16} /> Review your answers</h3></div>
          <div className="card__body">
            {(assessment.questions || []).map((q, i) => {
              const a = attempt.answers?.[q.$id] || {}
              const given = a.answer ?? ''
              const isWritten = q.type === 'short_answer'
              return (
                <div className="q-block" key={q.$id}>
                  <div className="q-block__head">
                    <div className="q-block__n">{i + 1}</div>
                    <div className="q-block__q">{q.body}</div>
                    {isWritten ? (
                      <Badge tone={a.needsReview ? 'warn' : 'info'}>
                        {a.needsReview ? 'Awaiting mark' : `${a.marks ?? 0}/${q.marks}`}
                      </Badge>
                    ) : (
                      <Badge tone={a.correct ? 'ok' : 'danger'}>
                        {a.correct ? <Icon name="check" size={11} /> : <Icon name="x" size={11} />} {a.marks ?? 0}/{q.marks}
                      </Badge>
                    )}
                  </div>

                  {(q.options || []).length > 0 && (
                    <div className="q-opts">
                      {q.options.map((opt, oi) => {
                        const isRight = opt === q.correctAnswer
                        const isMine = opt === given
                        let cls = 'q-opt'
                        if (isRight) cls += ' q-opt--right'
                        else if (isMine) cls += ' q-opt--wrong'
                        return (
                          <div key={oi} className={cls}>
                            <input type="radio" checked={isMine} readOnly />
                            <span>{opt}</span>
                            {isRight && <span style={{ marginLeft: 'auto' }}><Badge tone="ok">Correct answer</Badge></span>}
                            {isMine && !isRight && <span style={{ marginLeft: 'auto' }}><Badge tone="danger">Your answer</Badge></span>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {isWritten && (
                    <div className="mt-1">
                      <div className="stat__label mb-1">Your answer</div>
                      <div style={{
                        background: '#f8fafc', border: '1px solid var(--line)',
                        borderRadius: 'var(--r-sm)', padding: 12, whiteSpace: 'pre-wrap', fontSize: '.9rem',
                      }}>{given || '(no answer)'}</div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="tiny muted mt-2">
                      <b>Why:</b> {q.explanation}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="row">
        <Link className="btn" to={`/courses/${course.slug}/assessments/${assessmentId}/history`}>My attempts</Link>
        <Link className="btn btn--primary" to={`/courses/${course.slug}`}>Back to course</Link>
      </div>
    </div>
  )
}

export function AssessmentHistory() {
  const { course } = useCourse()
  const { assessmentId } = useParams()

  const { data, loading } = useAsync(async () => {
    const [assessment, attempts] = await Promise.all([
      backend.getAssessment(assessmentId),
      backend.listAttempts(assessmentId),
    ])
    return { assessment, attempts }
  }, [assessmentId])

  if (loading) return <Spinner />

  const { assessment, attempts } = data
  const mine = attempts // already filtered by the backend for students

  return (
    <div className="stack">
      <div>
        <Link className="btn btn--ghost btn--sm" to={`/courses/${course.slug}/assessments`}>‹ Back to tests &amp; exams</Link>
      </div>
      <h1>{assessment.title} — your attempts</h1>

      {mine.length === 0 ? (
        <div className="card"><div className="card__body muted small">You haven't attempted this yet.</div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Started</th>
                  <th>Submitted</th>
                  <th className="num">Score</th>
                  <th>Result</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.map((t, i) => (
                  <tr key={t.$id}>
                    <td className="b">{i + 1}</td>
                    <td className="small muted">{formatDateTime(t.startedAt)}</td>
                    <td className="small muted">{t.submittedAt ? formatDateTime(t.submittedAt) : '—'}</td>
                    <td className="num b">{t.status === 'in_progress' ? '—' : `${t.score}/${t.total}`}</td>
                    <td>
                      {t.status === 'in_progress' && <Badge tone="warn">In progress</Badge>}
                      {t.status === 'needs_marking' && <Badge tone="warn">Needs marking</Badge>}
                      {t.status === 'graded' && <Badge tone={t.passed ? 'ok' : 'danger'}>{t.percentage}% · {t.passed ? 'Passed' : 'Failed'}</Badge>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {t.status !== 'in_progress' && assessment.showResults && (
                        <Link className="btn btn--sm" to={`/courses/${course.slug}/assessments/${assessmentId}/result/${t.$id}`}>
                          Review
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
