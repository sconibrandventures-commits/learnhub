import { Link } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAuth } from '../../state/AuthContext'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, StatusBadge } from '../../components/ui'
import { classWindow, countdownText, formatTime, formatDate, formatDateTime } from '../../lib/helpers'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Classes() {
  const { course } = useCourse()
  const { user } = useAuth()
  useTicker(20000)

  const { data, loading } = useAsync(async () => {
    const classes = await backend.listClasses(course.$id)
    const attended = []
    for (const c of classes) {
      const rows = await backend.listAttendance(c.$id)
      attended.push({ classId: c.$id, mine: rows.find((r) => r.userId === user.$id) || null, count: rows.length })
    }
    return { classes, attended }
  }, [course.$id, user.$id])

  if (loading) return <Spinner />

  const classes = data?.classes || []
  const now = Date.now()
  const liveOnes = classes.filter((c) => classWindow(c, now).canJoin)
  const upcoming = classes.filter((c) => classWindow(c, now).state === 'upcoming' || classWindow(c, now).state === 'starting')
  const past = classes.filter((c) => classWindow(c, now).hasEnded || classWindow(c, now).state === 'cancelled')

  const Section = ({ title, icon, items, emptyText }) => (
    <div className="card">
      <div className="card__head">
        <h3><Icon name={icon} size={16} /> {title}</h3>
        <Badge>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="card__body muted small">{emptyText}</div>
      ) : (
        items.map((c) => {
          const w = classWindow(c, now)
          const att = data.attended.find((a) => a.classId === c.$id)
          const d = new Date(c.startsAt)
          return (
            <div className="class-row" key={c.$id}>
              <div className="class-row__date">
                <b>{d.getDate()}</b>
                <span>{MONTHS[d.getMonth()]}</span>
              </div>
              <div className="class-row__main">
                <h4>{c.title}</h4>
                <div className="meta">
                  {formatDate(c.startsAt)} · {formatTime(c.startsAt)}–{formatTime(w.endsAt)} · {c.durationMinutes} min
                </div>
                <div className="row mt-1" style={{ gap: 8 }}>
                  {w.state === 'live' && <Badge tone="live"><span className="dot pulse" />Live now</Badge>}
                  {w.state === 'starting' && <Badge tone="warn">Opens soon</Badge>}
                  {w.state === 'upcoming' && <Badge tone="info">{countdownText(c)}</Badge>}
                  {w.state === 'ended' && <Badge>Ended</Badge>}
                  {w.state === 'cancelled' && <StatusBadge status="cancelled" />}
                  {att?.mine && <Badge tone="ok"><Icon name="check" size={11} /> Attended · {att.mine.minutesPresent || 0} min</Badge>}
                  {c.status === 'ended' && !att?.mine && <Badge tone="danger">Missed</Badge>}
                </div>
                {c.description && <div className="small muted mt-1">{c.description}</div>}
              </div>
              <div className="row" style={{ gap: 8 }}>
                {w.canJoin ? (
                  <Link className="btn btn--join btn--sm" to={`/courses/${course.slug}/classes/${c.$id}/join`}>
                    <Icon name="play" size={14} /> Join
                  </Link>
                ) : w.state === 'upcoming' || w.state === 'starting' ? (
                  <button className="btn btn--sm" disabled title="The join button appears 15 minutes before the class starts">
                    <Icon name="lock" size={13} /> Not open yet
                  </button>
                ) : null}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Live classes</h1>
        <div className="muted small">
          Join from your browser or the Zoom app. The join button unlocks 15 minutes before each class starts.
        </div>
      </div>

      {classes.length === 0 && (
        <div className="card"><Empty icon="video" title="No classes scheduled">Your instructor hasn't scheduled any classes yet.</Empty></div>
      )}

      {liveOnes.length > 0 && <Section title="Live now" icon="video" items={liveOnes} />}
      <Section title="Upcoming" icon="calendar" items={upcoming} emptyText="No upcoming classes scheduled." />
      <Section title="Past classes" icon="clock" items={past} emptyText="No past classes yet." />
    </div>
  )
}
