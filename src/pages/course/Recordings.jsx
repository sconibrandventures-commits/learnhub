import { useState } from 'react'
import { useCourse } from '../../state/CourseContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge } from '../../components/ui'
import { formatDate, formatDateTime } from '../../lib/helpers'

export default function Recordings() {
  const { course } = useCourse()
  const [active, setActive] = useState(null)
  const { data, loading } = useAsync(() => backend.listRecordings(course.$id), [course.$id])

  if (loading) return <Spinner />

  const items = (data || []).filter((r) => r.isPublished)

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Recordings</h1>
        <div className="muted small">Missed a class? Catch up here. Recordings usually appear within 24 hours.</div>
      </div>

      {items.length === 0 ? (
        <div className="card"><Empty icon="play" title="No recordings yet">Recordings will appear here after your classes.</Empty></div>
      ) : (
        <div className="grid grid--2">
          {items.map((r) => (
            <div className="card" key={r.$id}>
              <div className="card__head">
                <h3 style={{ flex: 1 }}>{r.title}</h3>
                {r.durationMinutes && <Badge>{r.durationMinutes} min</Badge>}
              </div>
              <div className="card__body">
                <div className="small muted mb-2">
                  <Icon name="calendar" size={13} /> Recorded {formatDate(r.recordedAt)}
                  {r.liveClass && <> · from “{r.liveClass.title}”</>}
                </div>
                {r.description && <p className="small muted">{r.description}</p>}

                {active === r.$id && r.videoUrl ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--r-sm)', overflow: 'hidden', background: '#000' }}>
                    <iframe
                      title={r.title}
                      src={r.videoUrl}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button className="btn btn--primary btn--block" onClick={() => setActive(r.$id)} disabled={!r.videoUrl}>
                    <Icon name="play" size={15} /> {r.videoUrl ? 'Play recording' : 'No video attached'}
                  </button>
                )}

                {active === r.$id && r.videoUrl && (
                  <button className="btn btn--sm mt-1" onClick={() => setActive(null)}>Close player</button>
                )}
                {r.videoUrl && (
                  <div className="mt-2">
                    <a className="btn btn--sm" href={r.videoUrl} target="_blank" rel="noreferrer noopener">
                      <Icon name="link" size={14} /> Open in new tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
