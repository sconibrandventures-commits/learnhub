import { useCourse } from '../../state/CourseContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, Avatar } from '../../components/ui'
import { formatDateTime, timeAgo } from '../../lib/helpers'

export default function Announcements() {
  const { course } = useCourse()
  const { data, loading } = useAsync(() => backend.listAnnouncements(course.$id), [course.$id])

  if (loading) return <Spinner />

  const items = data || []

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Announcements</h1>
        <div className="muted small">News and reminders from your instructor.</div>
      </div>

      {items.length === 0 ? (
        <div className="card"><Empty icon="bell" title="No announcements yet">Nothing has been posted for this course.</Empty></div>
      ) : (
        items.map((a) => (
          <div className="card" key={a.$id} style={a.isPinned ? { borderColor: '#fcd34d', borderLeft: '4px solid #f59e0b' } : undefined}>
            <div className="card__head">
              <div className="row" style={{ gap: 10, flex: 1 }}>
                <Avatar name={a.author?.name || 'Instructor'} />
                <div>
                  <h3>{a.title}</h3>
                  <div className="small muted">
                    {a.author?.name || 'Instructor'} · {formatDateTime(a.publishedAt)} · {timeAgo(a.publishedAt)}
                  </div>
                </div>
              </div>
              {a.isPinned && <Badge tone="warn"><Icon name="star" size={11} /> Pinned</Badge>}
            </div>
            <div className="card__body" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
          </div>
        ))
      )}
    </div>
  )
}
