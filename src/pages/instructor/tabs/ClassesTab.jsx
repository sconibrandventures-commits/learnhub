import { useState } from 'react'
import { useToast } from '../../../state/ToastContext'
import { useAsync, useTicker } from '../../../lib/useAsync'
import backend from '../../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, ConfirmButton, StatusBadge } from '../../../components/ui'
import { classWindow, formatDateTime, formatTime } from '../../../lib/helpers'

const BLANK = {
  title: '', description: '', startsAt: '', durationMinutes: 90,
  zoomMeetingId: '', zoomPassword: '', zoomJoinUrl: '', zoomStartUrl: '', status: 'scheduled',
}

/** Convert a Date (or '') into the value a datetime-local input wants. */
function toLocalInput(d) {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ClassesTab({ course }) {
  const toast = useToast()
  useTicker(30000)
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attendanceFor, setAttendanceFor] = useState(null)

  const { data, loading, reload } = useAsync(async () => {
    const classes = await backend.listClasses(course.$id)
    const rows = await Promise.all(
      classes.map(async (c) => ({ cls: c, attendance: await backend.listAttendance(c.$id) }))
    )
    return rows.sort((a, b) => new Date(b.cls.startsAt) - new Date(a.cls.startsAt))
  }, [course.$id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function openCreate() {
    const d = new Date(Date.now() + 86400000)
    d.setMinutes(0, 0, 0)
    setEditing(null)
    setForm({ ...BLANK, startsAt: toLocalInput(d) })
    setOpen(true)
  }

  function openEdit(cls) {
    setEditing(cls)
    setForm({
      title: cls.title, description: cls.description || '',
      startsAt: toLocalInput(cls.startsAt), durationMinutes: cls.durationMinutes || 90,
      zoomMeetingId: cls.zoomMeetingId || '', zoomPassword: cls.zoomPassword || '',
      zoomJoinUrl: cls.zoomJoinUrl || '', zoomStartUrl: cls.zoomStartUrl || '',
      status: cls.status || 'scheduled',
    })
    setOpen(true)
  }

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give the class a title.')
    if (!form.startsAt) return toast.error('Choose a date and time.')
    setBusy(true)
    try {
      const payload = {
        ...form,
        durationMinutes: Number(form.durationMinutes) || 60,
        startsAt: new Date(form.startsAt).toISOString(),
      }
      if (editing) {
        await backend.updateClass(editing.$id, payload)
        toast.success('Class updated.')
      } else {
        await backend.createClass(course.$id, payload)
        toast.success('Class scheduled.')
      }
      setOpen(false)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(cls, status) {
    try {
      await backend.updateClass(cls.$id, { status })
      toast.success(status === 'live' ? 'Class is now live — students can join.' : 'Class updated.')
      reload()
    } catch (err) { toast.error(err.message) }
  }

  async function remove(cls) {
    try { await backend.deleteClass(cls.$id); toast.success('Class deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div>
      <div className="row row--between mb-2">
        <div className="muted small">
          Each class needs a Zoom link. Create it automatically with the Zoom API, or paste a link from your Zoom app.
        </div>
        <button className="btn btn--primary" onClick={openCreate}><Icon name="plus" size={15} /> Schedule class</button>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon="video" title="No classes yet"
            action={<button className="btn btn--primary" onClick={openCreate}>Schedule your first class</button>}>
            Students will see the join button here 15 minutes before each class starts.
          </Empty>
        </div>
      ) : (
        <div className="card">
          {rows.map(({ cls, attendance }) => {
            const w = classWindow(cls)
            return (
              <div className="class-row" key={cls.$id} style={{ alignItems: 'flex-start' }}>
                <div className="class-row__main">
                  <div className="row" style={{ gap: 8 }}>
                    <h4>{cls.title}</h4>
                    {w.state === 'live' && <Badge tone="live"><span className="dot pulse" />Live</Badge>}
                    {w.state === 'upcoming' && <Badge tone="info">Upcoming</Badge>}
                    {w.hasEnded && <Badge>Ended</Badge>}
                    {cls.status === 'cancelled' && <StatusBadge status="cancelled" />}
                  </div>
                  <div className="meta">
                    {formatDateTime(cls.startsAt)} · {cls.durationMinutes} min
                    {cls.zoomMeetingId && <> · ID <span className="mono">{cls.zoomMeetingId}</span></>}
                    {cls.zoomPassword && <> · pass <span className="mono">{cls.zoomPassword}</span></>}
                  </div>
                  <div className="row tiny muted mt-1" style={{ gap: 14 }}>
                    <span><Icon name="users" size={12} /> {attendance.length} attended</span>
                    {cls.zoomJoinUrl && <>· <a href={cls.zoomJoinUrl} target="_blank" rel="noreferrer noopener">join link</a></>}
                  </div>
                </div>

                <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {cls.zoomStartUrl && (
                    <a className="btn btn--sm btn--primary" href={cls.zoomStartUrl} target="_blank" rel="noreferrer noopener">
                      <Icon name="video" size={13} /> Start (host)
                    </a>
                  )}
                  <button className="btn btn--sm" onClick={() => setAttendanceFor(cls)}>
                    <Icon name="users" size={13} /> Attendance
                  </button>
                  {(cls.status === 'scheduled' || cls.status === 'live') && (
                    <button className="btn btn--sm btn--outline" onClick={() => setStatus(cls, 'live')}>
                      Go live
                    </button>
                  )}
                  {cls.status === 'live' && (
                    <button className="btn btn--sm btn--outline" onClick={() => setStatus(cls, 'ended')}>End class</button>
                  )}
                  <button className="btn btn--sm" onClick={() => openEdit(cls)}><Icon name="edit" size={13} /></button>
                  <ConfirmButton onConfirm={() => remove(cls)} confirmLabel="Delete?" className="btn btn--sm btn--ghost">
                    <Icon name="trash" size={13} />
                  </ConfirmButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / edit */}
      {open && (
        <Modal title={editing ? 'Edit class' : 'Schedule a class'} onClose={() => setOpen(false)} width={640}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule class'}
              </button>
            </>
          }>
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="ct">Class title</label>
              <input id="ct" type="text" value={form.title} onChange={set('title')} placeholder="Week 1 — How the web works" required />
            </div>
            <div className="field">
              <label htmlFor="cd">Description</label>
              <textarea id="cd" value={form.description} onChange={set('description')} placeholder="What will you cover?" style={{ minHeight: 70 }} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="cs">Starts</label>
                <input id="cs" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required />
              </div>
              <div className="field">
                <label htmlFor="cdur">Duration (minutes)</label>
                <input id="cdur" type="number" min="10" step="5" value={form.durationMinutes} onChange={set('durationMinutes')} />
              </div>
            </div>
            <hr />
            <div className="b mb-1">Zoom meeting</div>
            <div className="alert alert--info mb-2 small">
              With Zoom API keys configured you can create meetings automatically. For now, create the meeting in your
              Zoom app and paste the details below — students see the join link and never see your host link.
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="zid">Meeting ID</label>
                <input id="zid" type="text" value={form.zoomMeetingId} onChange={set('zoomMeetingId')} placeholder="812 3456 7890" />
              </div>
              <div className="field">
                <label htmlFor="zpw">Passcode</label>
                <input id="zpw" type="text" value={form.zoomPassword} onChange={set('zoomPassword')} placeholder="web101" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="zjoin">Join URL <span className="muted">(students see this)</span></label>
              <input id="zjoin" type="text" value={form.zoomJoinUrl} onChange={set('zoomJoinUrl')} placeholder="https://zoom.us/j/81234567890?pwd=..." />
            </div>
            <div className="field">
              <label htmlFor="zstart">Start URL <span className="muted">(host only, never shown to students)</span></label>
              <input id="zstart" type="text" value={form.zoomStartUrl} onChange={set('zoomStartUrl')} placeholder="https://zoom.us/s/81234567890?zak=..." />
            </div>
            <div className="field">
              <label htmlFor="cstat">Status</label>
              <select id="cstat" value={form.status} onChange={set('status')}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live now</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* Attendance */}
      {attendanceFor && (
        <AttendanceModal cls={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </div>
  )
}

function AttendanceModal({ cls, onClose }) {
  const { data, loading } = useAsync(() => backend.listAttendance(cls.$id), [cls.$id])
  return (
    <Modal title={`Attendance — ${cls.title}`} onClose={onClose} width={620}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      {loading ? <Spinner /> : (data || []).length === 0 ? (
        <div className="muted small">Nobody has joined this class yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Joined</th><th>Last seen</th><th className="num">Minutes</th></tr>
            </thead>
            <tbody>
              {(data || []).map((a) => (
                <tr key={a.$id}>
                  <td>
                    <div>{a.user?.name || 'Unknown'}</div>
                    <div className="tiny muted">{a.user?.email}</div>
                  </td>
                  <td className="small muted">{formatTime(a.joinedAt)}</td>
                  <td className="small muted">{a.lastPingAt ? formatTime(a.lastPingAt) : '—'}</td>
                  <td className="num b">{a.minutesPresent || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
