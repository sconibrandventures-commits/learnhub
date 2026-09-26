import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, ConfirmButton } from '../../../components/ui'
import { formatDateTime, timeAgo } from '../../../lib/helpers'

const BLANK = { title: '', description: '', dueAt: '', maxScore: 20, isPublished: true }

function toLocalInput(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function AssignmentsTab({ course }) {
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [viewFor, setViewFor] = useState(null)

  const { data, loading, reload } = useAsync(async () => {
    const assignments = await backend.listAssignments(course.$id)
    const rows = await Promise.all(
      assignments.map(async (a) => ({
        assignment: a,
        submissions: await backend.listSubmissions(a.$id),
      }))
    )
    return rows
  }, [course.$id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function openCreate() {
    setEditing(null)
    const d = new Date(Date.now() + 7 * 86400000); d.setMinutes(0, 0, 0)
    setForm({ ...BLANK, dueAt: toLocalInput(d) })
    setOpen(true)
  }

  function openEdit(a) {
    setEditing(a)
    setForm({
      title: a.title, description: a.description || '', dueAt: toLocalInput(a.dueAt),
      maxScore: a.maxScore, isPublished: a.isPublished ?? true,
    })
    setOpen(true)
  }

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give the assignment a title.')
    setBusy(true)
    try {
      const payload = {
        ...form,
        maxScore: Number(form.maxScore) || 10,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      }
      if (editing) { await backend.updateAssignment(editing.$id, payload); toast.success('Assignment updated.') }
      else { await backend.createAssignment(course.$id, payload); toast.success('Assignment created.') }
      setOpen(false)
      reload()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  async function remove(a) {
    try { await backend.deleteAssignment(a.$id); toast.success('Assignment deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div>
      <div className="row row--between mb-2">
        <div className="muted small">Set work, collect submissions and return marks with feedback.</div>
        <button className="btn btn--primary" onClick={openCreate}><Icon name="plus" size={15} /> New assignment</button>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon="clipboard" title="No assignments yet"
            action={<button className="btn btn--primary" onClick={openCreate}>Create your first assignment</button>}>
            Students submit typed answers or a file, and you grade them here.
          </Empty>
        </div>
      ) : (
        <div className="card">
          {rows.map(({ assignment, submissions }) => {
            const waiting = submissions.filter((s) => s.status === 'submitted').length
            return (
              <div className="class-row" key={assignment.$id} style={{ alignItems: 'flex-start' }}>
                <div className="class-row__main">
                  <div className="row" style={{ gap: 8 }}>
                    <h4>{assignment.title}</h4>
                    {!assignment.isPublished && <Badge>Draft</Badge>}
                    {waiting > 0 && <Badge tone="warn">{waiting} to grade</Badge>}
                  </div>
                  <div className="meta">
                    {assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)} · ${timeAgo(assignment.dueAt)}` : 'No deadline'}
                    {' '}· {assignment.maxScore} marks · {submissions.length} submissions
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--sm btn--primary" onClick={() => setViewFor(assignment)}>
                    <Icon name="users" size={13} /> Submissions
                  </button>
                  <button className="btn btn--sm" onClick={() => openEdit(assignment)}><Icon name="edit" size={13} /></button>
                  <ConfirmButton onConfirm={() => remove(assignment)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                    <Icon name="trash" size={13} />
                  </ConfirmButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <Modal title={editing ? 'Edit assignment' : 'New assignment'} onClose={() => setOpen(false)} width={620}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create assignment'}
              </button>
            </>
          }>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="at">Title</label>
              <input id="at" type="text" value={form.title} onChange={set('title')} placeholder="Build a one-page profile" required />
            </div>
            <div className="field">
              <label htmlFor="adesc">Instructions</label>
              <textarea id="adesc" value={form.description} onChange={set('description')}
                placeholder="What should students do?" style={{ minHeight: 110 }} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="adue">Due date</label>
                <input id="adue" type="datetime-local" value={form.dueAt} onChange={set('dueAt')} />
              </div>
              <div className="field">
                <label htmlFor="amax">Marks</label>
                <input id="amax" type="number" min="1" value={form.maxScore} onChange={set('maxScore')} />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
              Published — students can see this
            </label>
          </form>
        </Modal>
      )}

      {viewFor && <SubmissionsModal assignment={viewFor} onClose={() => setViewFor(null)} onChanged={reload} />}
    </div>
  )
}

function SubmissionsModal({ assignment, onClose, onChanged }) {
  const toast = useToast()
  const [saving, setSaving] = useState(null)
  const [grades, setGrades] = useState({})

  const { data, loading, reload } = useAsync(() => backend.listSubmissions(assignment.$id), [assignment.$id])
  const submissions = data || []

  const set = (id, k) => (e) => setGrades((g) => ({
    ...g, [id]: { ...(g[id] || {}), [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value },
  }))

  async function grade(sub) {
    const g = grades[sub.$id] || {}
    setSaving(sub.$id)
    try {
      await backend.gradeSubmission(sub.$id, {
        score: g.score ?? sub.score ?? '',
        feedback: g.feedback ?? sub.feedback ?? '',
        returned: g.returned ?? false,
      })
      toast.success(`Saved for ${sub.user?.name || 'student'}.`)
      reload()
      onChanged?.()
    } catch (err) { toast.error(err.message) } finally { setSaving(null) }
  }

  return (
    <Modal title={`Submissions — ${assignment.title}`} onClose={onClose} width={760}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      {loading ? <Spinner /> : submissions.length === 0 ? (
        <div className="muted small">No submissions yet.</div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {submissions.map((s) => (
            <div className="card" key={s.$id} style={{ boxShadow: 'none' }}>
              <div className="card__head">
                <div style={{ flex: 1 }}>
                  <div className="b">{s.user?.name || 'Unknown student'}</div>
                  <div className="tiny muted">{s.user?.email} · submitted {formatDateTime(s.submittedAt)}</div>
                </div>
                {s.status === 'submitted' && <Badge tone="warn">Needs grading</Badge>}
                {s.status === 'graded' && <Badge tone="ok">Graded</Badge>}
                {s.status === 'returned' && <Badge tone="ok">Returned</Badge>}
              </div>
              <div className="card__body">
                <div className="stat__label mb-1">Answer</div>
                <pre style={{
                  background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
                  padding: 12, overflowX: 'auto', fontSize: '.82rem', margin: '0 0 14px', whiteSpace: 'pre-wrap',
                }}>{s.body || '(nothing written)'}</pre>
                {s.fileName && (
                  <div className="small mb-2"><Icon name="download" size={13} /> Attached: <b>{s.fileName}</b></div>
                )}

                <div className="field-row">
                  <div className="field">
                    <label>Score (out of {assignment.maxScore})</label>
                    <input type="number" min="0" max={assignment.maxScore}
                      value={grades[s.$id]?.score ?? s.score ?? ''} onChange={set(s.$id, 'score')} />
                  </div>
                  <div className="field">
                    <label>Feedback</label>
                    <input type="text" value={grades[s.$id]?.feedback ?? s.feedback ?? ''}
                      onChange={set(s.$id, 'feedback')} placeholder="Well done — remember to…" />
                  </div>
                </div>
                <div className="row row--between">
                  <label className="check">
                    <input type="checkbox" checked={grades[s.$id]?.returned ?? s.status === 'returned'}
                      onChange={set(s.$id, 'returned')} />
                    Return to student (locks further edits)
                  </label>
                  <button className="btn btn--primary btn--sm" onClick={() => grade(s)} disabled={saving === s.$id}>
                    {saving === s.$id ? 'Saving…' : 'Save grade'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
