import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, ConfirmButton } from '../../../components/ui'

const TYPES = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short answer (marked by hand)' },
]

const BLANK = { type: 'mcq', body: '', options: ['', '', '', ''], correctAnswer: '', marks: 1, explanation: '' }

export default function QuestionsTab({ course }) {
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const { data, loading, reload } = useAsync(() => backend.listQuestions(course.$id), [course.$id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setOption = (i) => (e) => setForm((f) => {
    const opts = [...f.options]
    opts[i] = e.target.value
    return { ...f, options: opts }
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...BLANK, options: ['', '', '', ''] })
    setOpen(true)
  }

  function openEdit(q) {
    setEditing(q)
    setForm({
      type: q.type, body: q.body,
      options: (q.options || []).length ? [...q.options, '', ''].slice(0, Math.max(4, (q.options || []).length + 1)) : ['', '', '', ''],
      correctAnswer: q.correctAnswer || '', marks: q.marks || 1, explanation: q.explanation || '',
    })
    setOpen(true)
  }

  function changeType(type) {
    setForm((f) => ({
      ...f, type,
      options: type === 'true_false' ? ['True', 'False'] : type === 'mcq' ? (f.options.length >= 2 ? f.options : ['', '', '', '']) : [],
      correctAnswer: '',
    }))
  }

  async function save(e) {
    e?.preventDefault()
    if (!form.body.trim()) return toast.error('Write the question.')
    const opts = form.options.map((o) => o.trim()).filter(Boolean)
    if ((form.type === 'mcq' || form.type === 'true_false') && opts.length < 2)
      return toast.error('Add at least two options.')
    if ((form.type === 'mcq' || form.type === 'true_false') && !opts.includes(form.correctAnswer))
      return toast.error('Pick which option is the correct answer.')
    setBusy(true)
    try {
      const payload = { ...form, options: opts, marks: Number(form.marks) || 1 }
      if (editing) { await backend.updateQuestion(editing.$id, payload); toast.success('Question updated.') }
      else { await backend.createQuestion(course.$id, payload); toast.success('Question added to the bank.') }
      setOpen(false)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function remove(q) {
    try { await backend.deleteQuestion(q.$id); toast.success('Question deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Spinner />

  const questions = (data || []).filter((q) => filter === 'all' || q.type === filter)

  return (
    <div>
      <div className="row row--between mb-2">
        <div className="muted small">
          Build a reusable bank of questions, then assemble them into tests and exams.
        </div>
        <div className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All types</option>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button className="btn btn--primary" onClick={openCreate}><Icon name="plus" size={15} /> New question</button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="card">
          <Empty icon="help" title="No questions yet"
            action={<button className="btn btn--primary" onClick={openCreate}>Add your first question</button>}>
            Questions are stored here so you can reuse them in any test or exam.
          </Empty>
        </div>
      ) : (
        <div className="card">
          {questions.map((q, i) => (
            <div className="class-row" key={q.$id} style={{ alignItems: 'flex-start' }}>
              <div className="class-row__main">
                <div className="row" style={{ gap: 8 }}>
                  <h4>{i + 1}. {q.body}</h4>
                  <Badge tone="brand">{q.marks} mark{q.marks === 1 ? '' : 's'}</Badge>
                  <Badge>{TYPES.find((t) => t.value === q.type)?.label || q.type}</Badge>
                </div>
                {(q.options || []).length > 0 && (
                  <div className="row tiny muted mt-1" style={{ gap: 12 }}>
                    {(q.options || []).map((o, oi) => (
                      <span key={oi} style={o === q.correctAnswer ? { color: 'var(--ok)', fontWeight: 700 } : undefined}>
                        {o === q.correctAnswer && <Icon name="check" size={11} />} {o}
                      </span>
                    ))}
                  </div>
                )}
                {q.type === 'short_answer' && (
                  <div className="tiny muted mt-1">Marked by hand — students see your score after you mark it.</div>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--sm" onClick={() => openEdit(q)}><Icon name="edit" size={13} /></button>
                <ConfirmButton onConfirm={() => remove(q)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                  <Icon name="trash" size={13} />
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title={editing ? 'Edit question' : 'New question'} onClose={() => setOpen(false)} width={620}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add question'}
              </button>
            </>
          }>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="qt">Type</label>
              <select id="qt" value={form.type} onChange={(e) => changeType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="qb">Question</label>
              <textarea id="qb" value={form.body} onChange={set('body')}
                placeholder="What does HTML stand for?" style={{ minHeight: 80 }} />
            </div>

            {(form.type === 'mcq' || form.type === 'true_false') && (
              <div className="field">
                <label>Options — pick the correct one</label>
                <div className="stack" style={{ gap: 8 }}>
                  {form.options.map((opt, i) => (
                    <div className="row" key={i} style={{ gap: 8 }}>
                      <input type="radio" name="correct"
                        checked={opt.trim() !== '' && form.correctAnswer === opt}
                        onChange={() => setForm((f) => ({ ...f, correctAnswer: opt }))}
                        style={{ width: 18, flex: '0 0 18px', accentColor: 'var(--brand)' }} />
                      <input type="text" value={opt} onChange={setOption(i)}
                        placeholder={form.type === 'true_false' ? (i === 0 ? 'True' : 'False') : `Option ${i + 1}`}
                        disabled={form.type === 'true_false'} />
                      {form.type === 'mcq' && form.options.length > 2 && (
                        <button type="button" className="btn btn--sm btn--ghost"
                          onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))}>
                          <Icon name="x" size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.type === 'mcq' && (
                  <button type="button" className="btn btn--sm mt-1"
                    onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}>
                    <Icon name="plus" size={13} /> Add option
                  </button>
                )}
                <div className="hint">Select the radio button next to the correct answer.</div>
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label htmlFor="qm">Marks</label>
                <input id="qm" type="number" min="1" value={form.marks} onChange={set('marks')} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="qe">Explanation <span className="muted">(shown to students after they submit)</span></label>
              <textarea id="qe" value={form.explanation} onChange={set('explanation')}
                placeholder="Why is this the right answer?" style={{ minHeight: 70 }} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
