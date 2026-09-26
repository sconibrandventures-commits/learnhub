import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useToast } from '../../state/ToastContext'
import { useAsync, useInterval } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge } from '../../components/ui'
import { classWindow, formatDateTime, formatTime } from '../../lib/helpers'

export default function ClassJoin() {
  const { course } = useCourse()
  const { classId } = useParams()
  const toast = useToast()
  const [now, setNow] = useState(Date.now())
  const [copied, setCopied] = useState('')

  useInterval(() => setNow(Date.now()), 1000)

  const { data, loading, error } = useAsync(async () => {
    const cls = await backend.getClass(classId)
    if (cls.courseId !== course.$id) throw new Error('That class does not belong to this course.')
    return cls
  }, [classId, course.$id])

  // Record attendance once when the student opens the room, then ping every 60s.
  useEffect(() => {
    if (!data) return
    let cancelled = false
    backend.joinClass(classId).catch(() => {})
    const id = setInterval(() => { if (!cancelled) backend.heartbeat(classId).catch(() => {}) }, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [data, classId])

  const window_ = useMemo(() => (data ? classWindow(data, now) : null), [data, now])

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(''), 1800)
    } catch {
      toast.error("Couldn't copy — please select and copy manually.")
    }
  }

  if (loading) return <Spinner label="Opening classroom…" />
  if (error) return <Alert tone="danger">{error.message}</Alert>
  if (!data) return null

  const endsIn = Math.max(0, Math.round((new Date(window_.endsAt).getTime() - now) / 1000))
  const mins = Math.floor(endsIn / 60)
  const secs = String(endsIn % 60).padStart(2, '0')
  const notOpen = !window_.canJoin && !window_.hasEnded && window_.state !== 'live'
  const hasEnded = window_.hasEnded

  return (
    <div className="stack">
      <div>
        <Link className="btn btn--ghost btn--sm" to={`/courses/${course.slug}/classes`}>
          ‹ Back to classes
        </Link>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '22px 24px',
          background: hasEnded ? 'linear-gradient(135deg,#334155,#475569)' : 'linear-gradient(135deg,#312e81,#4f46e5 60%,#7c3aed)',
          color: '#fff',
        }}>
          <div className="row row--between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 10, marginBottom: 6 }}>
                {window_.live ? (
                  <Badge tone="live"><span className="dot pulse" />Live now</Badge>
                ) : hasEnded ? (
                  <Badge>Class ended</Badge>
                ) : (
                  <Badge tone="warn">Starts soon</Badge>
                )}
                <span className="small" style={{ opacity: .9 }}>
                  {formatDateTime(data.startsAt)} · {data.durationMinutes} minutes
                </span>
              </div>
              <h1 style={{ color: '#fff', marginBottom: 4 }}>{data.title}</h1>
              <div style={{ opacity: .92, fontSize: '.92rem' }}>
                {course.title} · {course.instructor?.name}
              </div>
            </div>
            {window_.live && (
              <div style={{ textAlign: 'center' }}>
                <div className="small" style={{ opacity: .85, marginBottom: 2 }}>Time left</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '1.7rem', fontWeight: 700 }}>
                  {mins}:{secs}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card__body">
          {notOpen && (
            <Alert tone="warn" title="The classroom isn't open yet">
              Join becomes available 15 minutes before the class starts. You can copy the meeting details below and
              join directly in Zoom if you prefer.
            </Alert>
          )}
          {hasEnded && (
            <Alert tone="info" title="This class has finished">
              A recording will usually appear in <b>Recordings</b> within 24 hours.
            </Alert>
          )}

          {data.description && <p className="muted">{data.description}</p>}

          {/* Meeting details */}
          <div className="grid grid--2 mt-2">
            <div className="card">
              <div className="card__body">
                <div className="stat__label mb-1">Meeting ID</div>
                <div className="row row--between">
                  <span className="mono b" style={{ fontSize: '1.05rem' }}>{data.zoomMeetingId || '—'}</span>
                  {data.zoomMeetingId && (
                    <button className="btn btn--sm" onClick={() => copy(data.zoomMeetingId.replace(/\s/g, ''), 'id')}>
                      <Icon name="clipboard" size={14} /> {copied === 'id' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card__body">
                <div className="stat__label mb-1">Passcode</div>
                <div className="row row--between">
                  <span className="mono b" style={{ fontSize: '1.05rem' }}>{data.zoomPassword || '—'}</span>
                  {data.zoomPassword && (
                    <button className="btn btn--sm" onClick={() => copy(data.zoomPassword, 'pw')}>
                      <Icon name="clipboard" size={14} /> {copied === 'pw' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Join actions */}
          <div className="row mt-3" style={{ gap: 12 }}>
            {data.zoomJoinUrl ? (
              <a className="btn btn--join btn--lg" href={data.zoomJoinUrl} target="_blank" rel="noreferrer noopener">
                <Icon name="video" size={18} /> Open in Zoom
              </a>
            ) : (
              <button className="btn btn--join btn--lg" disabled>No Zoom link on this class</button>
            )}
            <button className="btn btn--lg" onClick={() => copy(data.zoomJoinUrl || '', 'url')} disabled={!data.zoomJoinUrl}>
              <Icon name="link" size={16} /> {copied === 'url' ? 'Copied' : 'Copy join link'}
            </button>
          </div>

          {data.zoomJoinUrl && (
            <div className="mt-2" style={{ wordBreak: 'break-all' }}>
              <div className="stat__label mb-1">Join URL</div>
              <code className="small muted">{data.zoomJoinUrl}</code>
            </div>
          )}

          <hr />

          <div className="row" style={{ gap: 10 }}>
            <span className="muted"><Icon name="clock" size={16} /></span>
            <div className="small muted">
              Your attendance is being recorded for this session
              {window_.live ? ' — this page keeps your attendance alive, so leave it open.' : '.'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><h3><Icon name="help" size={16} /> Having trouble joining?</h3></div>
        <div className="card__body small muted">
          <p>
            Zoom works best in the desktop app, but you can also join from your browser — choose
            <b> “Join from your browser”</b> at the bottom of the page Zoom opens.
          </p>
          <p className="mb-0">
            If the link doesn't work, open Zoom, choose <b>Join a Meeting</b>, and enter the meeting ID and passcode above.
            Class ends at {formatTime(window_.endsAt)}.
          </p>
        </div>
      </div>
    </div>
  )
}
