import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, ConfirmButton, Alert } from '../../../components/ui'
import { formatDateTime } from '../../../lib/helpers'

const BLANK = {
  title: '', type: 'test', instructions: '', startsAt: '', endsAt: '',
  durationMinutes: 30, maxAttempts: 1, passMark: 50,
  shuffleQuestions: false, showResults: true, isPublished: false,
}

function toLocalInput(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TestsTab({ course }) {
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [questionsFor, setQuestionsFor] = useState(null)
  const [resultsFor, setResultsFor] = useState(null)

  const { data, loading, reload } = useAsync(() => backend.listAssessments(course.$id), [course.$id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function openCreate() {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  function openEdit(a) {
    setEditing(a)
    setForm({
      title: a.title, type: a.type, instructions: a.instructions || '',
      startsAt: toLocalInput(a.startsAt), endsAt: toLocalInput(a.endsAt),
      durationMinutes: a.durationMinutes, maxAttempts: a.maxAttempts, passMark: a.passMark,
      shuffleQuestions: a.shuffleQuestions, showResults: a.showResults, isPublished: a.isPublished,
    })
    setOpen(true)
  }

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give it a title.')
    setBusy(true)
    try {
      const payload = {
        ...form,
        durationMinutes: Number(form.durationMinutes) || 30,
        maxAttempts: Number(form.maxAttempts) || 1,
        passMark: Number(form.passMark) || 50,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }
      if (editing) { await backend.updateAssessment(editing.$id, payload); toast.success('Assessment updated.') }
      else { await backend.createAssessment(course.$id, payload); toast.success('Created — now add questions to it.') }
      setOpen(false)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function remove(a) {
    try { await backend.deleteAssessment(a.$id); toast.success('Deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div>
      <div className="row row--between mb-2">
        <div className="muted small">Assemble questions from your bank into a timed test or exam.</div>
        <button className="btn btn--primary" onClick={openCreate}><Icon name="plus" size={15} /> New test</button>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon="quiz" title="No tests or exams yet"
            action={<button className="btn btn--primary" onClick={openCreate}>Create one</button>}>
            Add questions in the Question bank first, then build a test from them.
          </Empty>
        </div>
      ) : (
        <div className="card">
          {rows.map((a) => (
            <div className="class-row" key={a.$id} style={{ alignItems: 'flex-start' }}>
              <div className="class-row__main">
                <div className="row" style={{ gap: 8 }}>
                  <h4>{a.title}</h4>
                  <Badge tone={a.type === 'exam' ? 'danger' : 'brand'}>{a.type}</Badge>
                  {!a.isPublished && <Badge>Draft</Badge>}
                  {a.isPublished && a.isOpen && <Badge tone="ok">Open now</Badge>}
                </div>
                <div className="meta">
                  {a.questionCount || 0} questions · {a.totalMarks || 0} marks · {a.durationMinutes} min ·
                  pass {a.passMark}% · {a.maxAttempts} attempt{a.maxAttempts === 1 ? '' : 's'}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn--sm btn--primary" onClick={() => setQuestionsFor(a)}>
                  <Icon name="help" size={13} /> Questions
                </button>
                <button className="btn btn--sm" onClick={() => setResultsFor(a)}>
                  <Icon name="chart" size={13} /> Results
                </button>
                <button className="btn btn--sm" onClick={() => openEdit(a)}><Icon name="edit" size={13} /></button>
                <ConfirmButton onConfirm={() => remove(a)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                  <Icon name="trash" size={13} />
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title={editing ? 'Edit assessment' : 'New test or exam'} onClose={() => setOpen(false)} width={660}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create'}
              </button>
            </>
          }>
          <form onSubmit={save}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="tt">Title</label>
                <input id="tt" type="text" value={form.title} onChange={set('title')} placeholder="Week 1 Knowledge Check" required />
              </div>
              <div className="field">
                <label htmlFor="tty">Type</label>
                <select id="tty" value={form.type} onChange={set('type')}>
                  <option value="test">Test</option>
                  <option value="exam">Exam</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="ti">Instructions</label>
              <textarea id="ti" value={form.instructions} onChange={set('instructions')}
                placeholder="Anything students should know before they start." style={{ minHeight: 70 }} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="td">Time limit (minutes)</label>
                <input id="td" type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} />
              </div>
              <div className="field">
                <label htmlFor="ta">Attempts allowed</label>
                <input id="ta" type="number" min="1" value={form.maxAttempts} onChange={set('maxAttempts')} />
              </div>
              <div className="field">
                <label htmlFor="tp">Pass mark (%)</label>
                <input id="tp" type="number" min="0" max="100" value={form.passMark} onChange={set('passMark')} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="ts">Opens <span className="muted">(optional)</span></label>
                <input id="ts" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
              </div>
              <div className="field">
                <label htmlFor="te">Closes <span className="muted">(optional)</span></label>
                <input id="te" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <label className="check">
                <input type="checkbox" checked={form.shuffleQuestions} onChange={set('shuffleQuestions')} />
                Shuffle the question order for each student
              </label>
              <label className="check">
                <input type="checkbox" checked={form.showResults} onChange={set('showResults')} />
                Show students their score and the correct answers straight away
              </label>
              <label className="check">
                <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
                Published — students can take this
              </label>
            </div>
          </form>
        </Modal>
      )}

      {questionsFor && <QuestionsModal assessment={questionsFor} course={course} onClose={() => setQuestionsFor(null)} onChanged={reload} />}
      {resultsFor && <ResultsModal assessment={resultsFor} onClose={() => setResultsFor(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function QuestionsModal({ assessment, course, onClose, onChanged }) {
  const toast = useToast()
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const { data } = useAsync(async () => {
    const [full, bank] = await Promise.all([
      backend.getAssessment(assessment.$id),
      backend.listQuestions(course.$id),
    ])
    const ids = (full.questions || []).map((q) => q.$id)
    setSelected(ids.map((id) => ({
      questionId: id,
      marks: full.questions.find((q) => q.$id === id)?.marks || 1,
    })))
    setLoaded(true)
    return full
  }, [assessment.$id])

  const bank = useAsync(() => backend.listQuestions(course.$id), [course.$id]).data || []
  const inTest = (id) => selected.find((s) => s.questionId === id)

  function toggle(q) {
    setSelected((s) => inTest(q.$id)
      ? s.filter((x) => x.questionId !== q.$id)
      : [...s, { questionId: q.$id, marks: q.marks || 1 }])
  }

  function setMarks(qid, marks) {
    setSelected((s) => s.map((x) => (x.questionId === qid ? { ...x, marks: Number(marks) || 1 } : x)))
  }

  function move(qid, dir) {
    setSelected((s) => {
      const i = s.findIndex((x) => x.questionId === qid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  async function save() {
    setBusy(true)
    try {
      const total = await backend.setAssessmentQuestions(assessment.$id, selected)
      toast.success(`Saved — ${selected.length} questions, ${total} marks total.`)
      onChanged?.()
      onClose()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  if (!loaded) return <Modal title="Loading…" onClose={onClose}><Spinner /></Modal>

  const totalMarks = selected.reduce((s, x) => s + (Number(x.marks) || 0), 0)

  return (
    <Modal title={`Questions — ${assessment.title}`} onClose={onClose} width={760}
      footer={
        <>
          <span className="muted small" style={{ marginRight: 'auto' }}>
            {selected.length} questions · {totalMarks} marks
          </span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save questions'}
          </button>
        </>
      }>
      {bank.length === 0 ? (
        <Alert tone="warn" title="Your question bank is empty">Add questions in the Question bank tab first.</Alert>
      ) : (
        <>
          <div className="stat__label mb-1">Your question bank — tick to include</div>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
            {bank.map((q) => (
              <label key={q.$id} className="row"
                style={{ gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!!inTest(q.$id)} onChange={() => toggle(q)}
                  style={{ width: 17, height: 17, accentColor: 'var(--brand)', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div className="small b">{q.body}</div>
                  <div className="tiny muted">
                    <Badge>{q.type === 'short_answer' ? 'short answer' : q.type === 'true_false' ? 'true/false' : 'multiple choice'}</Badge>
                    {' '}{q.marks} mark{q.marks === 1 ? '' : 's'}
                  </div>
                </div>
                {inTest(q.$id) && (
                  <input type="number" min="1" value={inTest(q.$id).marks}
                    onChange={(e) => setMarks(q.$id, e.target.value)} style={{ width: 74 }} />
                )}
              </label>
            ))}
          </div>

          {selected.length > 0 && (
            <>
              <div className="stat__label mt-3 mb-1">Order in the test</div>
              <div className="stack" style={{ gap: 6 }}>
                {selected.map((s, i) => {
                  const q = bank.find((x) => x.$id === s.questionId)
                  if (!q) return null
                  return (
                    <div key={s.questionId} className="row" style={{ gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>
                      <span className="badge">{i + 1}</span>
                      <span className="small" style={{ flex: 1 }}>{q.body}</span>
                      <span className="tiny muted">{s.marks} mk</span>
                      <button className="btn btn--sm btn--ghost" onClick={() => move(s.questionId, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn--sm btn--ghost" onClick={() => move(s.questionId, 1)} disabled={i === selected.length - 1}>↓</button>
                      <button className="btn btn--sm btn--ghost" onClick={() => toggle(q)}><Icon name="x" size={13} /></button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

function ResultsModal({ assessment, onClose }) {
  const toast = useToast()
  const { data, loading, reload } = useAsync(async () => {
    const [attempts, full] = await Promise.all([
      backend.listAttempts(assessment.$id),
      backend.getAssessment(assessment.$id),
    ])
    return { attempts, full }
  }, [assessment.$id])

  const [marking, setMarking] = useState(null)

  async function mark(attemptId, questionId, marks) {
    setMarking(`${attemptId}:${questionId}`)
    try {
      await backend.markAnswer(attemptId, questionId, marks)
      toast.success('Mark saved.')
      reload()
    } catch (err) { toast.error(err.message) } finally { setMarking(null) }
  }

  if (loading) return <Modal title="Loading…" onClose={onClose}><Spinner /></Modal>

  const attempts = (data?.attempts || []).filter((a) => a.status !== 'in_progress')
  const questions = (data?.full?.questions || []).filter((q) => q.type === 'short_answer')
  const needsMarking = attempts.filter((a) => a.status === 'needs_marking')

  return (
    <Modal title={`Results — ${assessment.title}`} onClose={onClose} width={860}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      {needsMarking.length > 0 && (
        <Alert tone="warn" title={`${needsMarking.length} submission(s) need hand marking`}>
          Short-answer questions are marked below.
        </Alert>
      )}

      {attempts.length === 0 ? (
        <div className="muted small mt-2">No attempts yet.</div>
      ) : (
        <div className="table-wrap mt-2">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Submitted</th><th className="num">Score</th>
                <th className="num">Percent</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.$id}>
                  <td>
                    <div>{a.user?.name || 'Unknown'}</div>
                    <div className="tiny muted">{a.user?.email}</div>
                  </td>
                  <td className="small muted">{a.submittedAt ? formatDateTime(a.submittedAt) : '—'}</td>
                  <td className="num b">{a.score}/{a.total}</td>
                  <td className="num">{a.percentage}%</td>
                  <td>
                    {a.status === 'needs_marking'
                      ? <Badge tone="warn">Needs marking</Badge>
                      : <Badge tone={a.passed ? 'ok' : 'danger'}>{a.passed ? 'Passed' : 'Failed'}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {questions.length > 0 && (
        <>
          <div className="stat__label mt-3 mb-1">Mark written answers</div>
          <div className="stack" style={{ gap: 16 }}>
            {attempts.filter((a) => a.status === 'needs_marking').map((a) =>
              questions.map((q) => {
                const given = a.answers?.[q.$id] || {}
                if (!given.needsReview) return null
                return (
                  <div key={`${a.$id}:${q.$id}`} className="card" style={{ boxShadow: 'none' }}>
                    <div className="card__body">
                      <div className="small muted">{a.user?.name || 'Student'}</div>
                      <div className="b mb-1">{q.body}</div>
                      <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: 12, fontSize: '.9rem', whiteSpace: 'pre-wrap' }}>
                        {given.answer || '(no answer)'}
                      </div>
                      {q.correctAnswer && <div className="tiny muted mt-1">Model answer: {q.correctAnswer}</div>}
                      <div className="row mt-2">
                        <span className="small">Award</span>
                        <input type="number" min="0" max={q.marks}
                          defaultValue={given.marks || 0}
                          onBlur={(e) => mark(a.$id, q.$id, e.target.value)}
                          style={{ width: 90 }} />
                        <span className="small muted">out of {q.marks}</span>
                        {marking === `${a.$id}:${q.$id}` && <span className="small muted">saving…</span>}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
