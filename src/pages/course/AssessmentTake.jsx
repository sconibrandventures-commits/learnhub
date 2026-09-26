import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge, Modal } from '../../components/ui'

export default function AssessmentTake() {
  const { course } = useCourse()
  const { assessmentId, attemptId } = useParams()
  const toast = useToast()
  const navigate = useNavigate()

  const [answers, setAnswers] = useState({})
  const [remaining, setRemaining] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const submittedRef = useRef(false)

  const { data, loading, error } = useAsync(async () => {
    const [assessment, attempt] = await Promise.all([
      backend.getAssessment(assessmentId),
      backend.getAttempt(attemptId),
    ])
    const existing = {}
    Object.entries(attempt.answers || {}).forEach(([qid, v]) => {
      existing[qid] = typeof v === 'object' ? v.answer : v
    })
    setAnswers(existing)
    return { assessment, attempt }
  }, [assessmentId, attemptId])

  const deadline = useMemo(() => {
    if (!data) return null
    return new Date(data.attempt.startedAt).getTime() + data.assessment.durationMinutes * 60000
  }, [data])

  // Countdown
  useEffect(() => {
    if (!deadline) return
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  const doSubmit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setBusy(true)
    try {
      const result = await backend.submitAttempt(attemptId, answers)
      toast.success('Your answers have been submitted.')
      navigate(`/courses/${course.slug}/assessments/${assessmentId}/result/${result.$id}`, { replace: true })
    } catch (err) {
      submittedRef.current = false
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Auto-submit when time runs out
  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) {
      toast.info('Time is up — submitting your answers.')
      doSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  // Warn on leaving
  useEffect(() => {
    const handler = (e) => {
      if (!submittedRef.current) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (loading) return <Spinner label="Loading your assessment…" />
  if (error) return <Alert tone="danger">{error.message}</Alert>

  const { assessment, attempt } = data
  const questions = assessment.questions || []
  const answered = questions.filter((q) => (answers[q.$id] ?? '') !== '').length

  const secs = Math.floor((remaining ?? 0) / 1000)
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const timerTone = secs <= 60 ? 'danger' : secs <= 300 ? 'warn' : ''

  function setAnswer(qid, value) {
    setAnswers((a) => ({ ...a, [qid]: value }))
    backend.saveAnswers(attemptId, { [qid]: value }).catch(() => {})
  }

  return (
    <div className="stack">
      {/* Sticky header */}
      <div className="card">
        <div className="card__body row row--between">
          <div>
            <h2 style={{ marginBottom: 2 }}>{assessment.title}</h2>
            <div className="small muted">{answered} of {questions.length} answered</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className={`timer ${timerTone ? `timer--${timerTone}` : ''}`}>
              <Icon name="clock" size={14} /> {mm}:{ss}
            </span>
            <button className="btn btn--primary" onClick={() => setConfirmOpen(true)} disabled={busy}>
              {busy ? 'Submitting…' : 'Submit answers'}
            </button>
          </div>
        </div>
      </div>

      {questions.map((q, i) => {
        const value = answers[q.$id] ?? ''
        return (
          <div className="q-block" key={q.$id}>
            <div className="q-block__head">
              <div className="q-block__n">{i + 1}</div>
              <div className="q-block__q">{q.body}</div>
              <Badge>{q.marks} mark{q.marks === 1 ? '' : 's'}</Badge>
            </div>

            {(q.type === 'mcq' || q.type === 'true_false') && (
              <div className="q-opts">
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} className={`q-opt ${value === opt ? 'selected' : ''}`}>
                    <input type="radio" name={`q_${q.$id}`} checked={value === opt}
                      onChange={() => setAnswer(q.$id, opt)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === 'short_answer' && (
              <textarea
                value={value}
                onChange={(e) => setAnswer(q.$id, e.target.value)}
                placeholder="Type your answer…"
                style={{ minHeight: 110 }}
              />
            )}
          </div>
        )
      })}

      <div className="card">
        <div className="card__body row row--between">
          <span className="muted small">Check your answers before submitting — you can't change them afterwards.</span>
          <button className="btn btn--primary btn--lg" onClick={() => setConfirmOpen(true)} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit answers'}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <Modal
          title="Submit your answers?"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Keep working</button>
              <button className="btn btn--primary" onClick={() => { setConfirmOpen(false); doSubmit() }}>
                Yes, submit
              </button>
            </>
          }
        >
          <p>
            You have answered <b>{answered}</b> of <b>{questions.length}</b> questions.
          </p>
          {answered < questions.length && (
            <Alert tone="warn" title="Some questions are unanswered">
              Unanswered questions score zero. Are you sure you want to submit?
            </Alert>
          )}
        </Modal>
      )}
    </div>
  )
}
