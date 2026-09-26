import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, ConfirmButton } from '../../../components/ui'
import { formatDate, formatDateTime } from '../../../lib/helpers'

export default function ContentTab({ course }) {
  const toast = useToast()
  const [annOpen, setAnnOpen] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [editingAnn, setEditingAnn] = useState(null)
  const [editingRec, setEditingRec] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, reload } = useAsync(async () => {
    const [announcements, recordings, classes] = await Promise.all([
      backend.listAnnouncements(course.$id),
      backend.listRecordings(course.$id),
      backend.listClasses(course.$id),
    ])
    return { announcements, recordings, classes }
  }, [course.$id])

  if (loading) return <Spinner />

  const announcements = data?.announcements || []
  const recordings = data?.recordings || []
  const classes = data?.classes || []

  async function removeAnnouncement(a) {
    try { await backend.deleteAnnouncement(a.$id); toast.success('Deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }
  async function removeRecording(r) {
    try { await backend.deleteRecording(r.$id); toast.success('Deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <div className="stack">
      {/* Announcements */}
      <div>
        <div className="row row--between mb-2">
          <div>
            <h3>Announcements</h3>
            <div className="muted small">Post updates at the top of your course page. Pin the important ones.</div>
          </div>
          <button className="btn btn--primary" onClick={() => { setEditingAnn(null); setAnnOpen(true) }}>
            <Icon name="plus" size={15} /> New announcement
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="card"><div className="card__body muted small">No announcements yet.</div></div>
        ) : (
          <div className="card">
            {announcements.map((a) => (
              <div className="class-row" key={a.$id} style={{ alignItems: 'flex-start' }}>
                <div className="class-row__main">
                  <div className="row" style={{ gap: 8 }}>
                    <h4>{a.title}</h4>
                    {a.isPinned && <Badge tone="warn"><Icon name="star" size={11} /> Pinned</Badge>}
                  </div>
                  <div className="meta">{formatDateTime(a.publishedAt)}</div>
                  <div className="small muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{a.body.slice(0, 180)}{a.body.length > 180 ? '…' : ''}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--sm" onClick={() => { setEditingAnn(a); setAnnOpen(true) }}>
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="btn btn--sm" onClick={async () => {
                    try { await backend.updateAnnouncement(a.$id, { isPinned: !a.isPinned }); reload() }
                    catch (err) { toast.error(err.message) }
                  }}>
                    <Icon name="star" size={13} />
                  </button>
                  <ConfirmButton onConfirm={() => removeAnnouncement(a)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                    <Icon name="trash" size={13} />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recordings */}
      <div>
        <div className="row row--between mb-2">
          <div>
            <h3>Recordings</h3>
            <div className="muted small">Paste the link from Zoom (or YouTube/Vimeo) so students can catch up.</div>
          </div>
          <button className="btn btn--primary" onClick={() => { setEditingRec(null); setRecOpen(true) }}>
            <Icon name="plus" size={15} /> Add recording
          </button>
        </div>

        {recordings.length === 0 ? (
          <div className="card"><div className="card__body muted small">No recordings yet.</div></div>
        ) : (
          <div className="card">
            {recordings.map((r) => (
              <div className="class-row" key={r.$id} style={{ alignItems: 'flex-start' }}>
                <div className="class-row__main">
                  <div className="row" style={{ gap: 8 }}>
                    <h4>{r.title}</h4>
                    {!r.isPublished && <Badge>Hidden</Badge>}
                    {r.durationMinutes && <Badge>{r.durationMinutes} min</Badge>}
                  </div>
                  <div className="meta">Recorded {formatDate(r.recordedAt)}{r.liveClass && <> · from “{r.liveClass.title}”</>}</div>
                  {r.videoUrl && <div className="tiny muted" style={{ wordBreak: 'break-all' }}>{r.videoUrl}</div>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--sm" onClick={async () => {
                    try { await backend.updateRecording(r.$id, { isPublished: !r.isPublished }); reload() }
                    catch (err) { toast.error(err.message) }
                  }}>
                    {r.isPublished ? 'Hide' : 'Publish'}
                  </button>
                  <button className="btn btn--sm" onClick={() => { setEditingRec(r); setRecOpen(true) }}>
                    <Icon name="edit" size={13} />
                  </button>
                  <ConfirmButton onConfirm={() => removeRecording(r)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                    <Icon name="trash" size={13} />
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {annOpen && (
        <AnnouncementModal
          course={course} announcement={editingAnn} busy={busy} setBusy={setBusy}
          onClose={() => setAnnOpen(false)} onSaved={() => { setAnnOpen(false); reload() }}
        />
      )}

      {recOpen && (
        <RecordingModal
          course={course} recording={editingRec} classes={classes} busy={busy} setBusy={setBusy}
          onClose={() => setRecOpen(false)} onSaved={() => { setRecOpen(false); reload() }}
        />
      )}
    </div>
  )
}

function AnnouncementModal({ course, announcement, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: announcement?.title || '',
    body: announcement?.body || '',
    isPinned: announcement?.isPinned ?? false,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give it a title.')
    setBusy(true)
    try {
      if (announcement) { await backend.updateAnnouncement(announcement.$id, form); toast.success('Updated.') }
      else { await backend.createAnnouncement(course.$id, form); toast.success('Posted.') }
      onSaved()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={announcement ? 'Edit announcement' : 'New announcement'} onClose={onClose} width={620}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Post'}</button>
        </>
      }>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="annt">Title</label>
          <input id="annt" type="text" value={form.title} onChange={set('title')} placeholder="Welcome to the course!" required />
        </div>
        <div className="field">
          <label htmlFor="annb">Message</label>
          <textarea id="annb" value={form.body} onChange={set('body')} style={{ minHeight: 150 }}
            placeholder="Write your announcement…" />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.isPinned} onChange={set('isPinned')} />
          Pin to the top of the course page
        </label>
      </form>
    </Modal>
  )
}

function RecordingModal({ course, recording, classes, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: recording?.title || '',
    description: recording?.description || '',
    videoUrl: recording?.videoUrl || '',
    classId: recording?.classId || '',
    durationMinutes: recording?.durationMinutes || '',
    recordedAt: recording?.recordedAt ? recording.recordedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    isPublished: recording?.isPublished ?? true,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give the recording a title.')
    setBusy(true)
    try {
      const payload = {
        ...form,
        classId: form.classId || null,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        recordedAt: new Date(form.recordedAt).toISOString(),
      }
      if (recording) { await backend.updateRecording(recording.$id, payload); toast.success('Updated.') }
      else { await backend.createRecording(course.$id, payload); toast.success('Recording added.') }
      onSaved()
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={recording ? 'Edit recording' : 'Add recording'} onClose={onClose} width={620}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="rt">Title</label>
          <input id="rt" type="text" value={form.title} onChange={set('title')} placeholder="Week 1 — recording" required />
        </div>
        <div className="field">
          <label htmlFor="ru">Video URL</label>
          <input id="ru" type="text" value={form.videoUrl} onChange={set('videoUrl')}
            placeholder="https://zoom.us/rec/share/… or a YouTube embed link" />
          <div className="hint">
            Paste the share link from Zoom. For YouTube/Vimeo use the <b>embed</b> URL so it plays inside the portal.
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="rc">From class <span className="muted">(optional)</span></label>
            <select id="rc" value={form.classId} onChange={set('classId')}>
              <option value="">— none —</option>
              {classes.map((c) => <option key={c.$id} value={c.$id}>{c.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rr">Recorded on</label>
            <input id="rr" type="date" value={form.recordedAt} onChange={set('recordedAt')} />
          </div>
          <div className="field">
            <label htmlFor="rd">Minutes</label>
            <input id="rd" type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="rdesc">Notes</label>
          <textarea id="rdesc" value={form.description} onChange={set('description')} style={{ minHeight: 70 }} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} />
          Visible to students
        </label>
      </form>
    </Modal>
  )
}
