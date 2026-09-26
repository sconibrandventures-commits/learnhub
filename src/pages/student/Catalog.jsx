import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Badge, Spinner, Empty, PageHead } from '../../components/ui'
import { truncate } from '../../lib/helpers'

export default function Catalog() {
  const { user } = useAuth()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)

  const { data, loading, reload } = useAsync(async () => {
    const [courses, enrolments, myIds] = await Promise.all([
      backend.listCourses(),
      backend.listEnrolments({ userId: user.$id }),
      backend.myCourseIds(),
    ])
    return {
      courses: courses.filter((c) => c.status === 'published'),
      enrolments,
      myIds,
    }
  }, [user.$id])

  const courses = (data?.courses || []).filter((c) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return [c.title, c.code, c.category, c.description, c.instructor?.name]
      .filter(Boolean).join(' ').toLowerCase().includes(q)
  })

  async function join(course) {
    setBusyId(course.$id)
    try {
      await backend.enrol({ userId: user.$id, courseId: course.$id, status: 'active' })
      toast.success(`You are now enrolled in ${course.title}.`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Layout title="Course catalogue"><Spinner /></Layout>

  return (
    <Layout title="Course catalogue">
      <PageHead title="Course catalogue" subtitle="Courses you can join. Your instructor may also give you a code to enrol directly." />

      <div className="card mb-3">
        <div className="card__body">
          <div className="row">
            <Icon name="search" size={17} />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, code, category or instructor…" style={{ flex: 1, minWidth: 180 }} />
            {query && <button className="btn btn--ghost btn--sm" onClick={() => setQuery('')}>Clear</button>}
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="card"><Empty icon="search" title="No courses found"
          action={<button className="btn" onClick={() => setQuery('')}>Clear search</button>}>
          Try a different search term.
        </Empty></div>
      ) : (
        <div className="grid grid--3">
          {courses.map((c) => {
            const enrolled = data.myIds.includes(c.$id)
            const enrolment = data.enrolments.find((e) => e.courseId === c.$id)
            return (
              <div className="course-card" key={c.$id}>
                <div className="course-card__top" style={enrolled ? {} : { background: 'var(--line-2)' }} />
                <div className="course-card__body">
                  <div className="row row--between mb-1">
                    <h3>{c.title}</h3>
                    {enrolled
                      ? <Badge tone="ok"><Icon name="check" size={11} /> Enrolled</Badge>
                      : c.enrollmentOpen ? <Badge tone="info">Open</Badge> : <Badge>Closed</Badge>}
                  </div>
                  <div className="course-card__meta">
                    <span className="mono">{c.code}</span> · {c.instructor?.name || 'Unassigned'}
                    {c.category && <> · {c.category}</>}
                  </div>
                  <p className="course-card__desc">{truncate(c.description, 130)}</p>
                  <div className="row tiny muted mb-2" style={{ gap: 12 }}>
                    <span><Badge tone={c.level === 'beginner' ? 'ok' : c.level === 'intermediate' ? 'warn' : 'danger'}>{c.level}</Badge></span>
                    <span>Pass mark {c.passMark}%</span>
                  </div>
                  <div className="course-card__foot">
                    {enrolled ? (
                      <Link className="btn btn--primary" style={{ flex: 1 }} to={`/courses/${c.slug}`}>
                        Open course
                      </Link>
                    ) : c.enrollmentOpen ? (
                      <button className="btn btn--primary" style={{ flex: 1 }}
                        disabled={busyId === c.$id} onClick={() => join(c)}>
                        {busyId === c.$id ? 'Joining…' : 'Enrol now'}
                      </button>
                    ) : (
                      <button className="btn" style={{ flex: 1 }} disabled>Enrolment closed</button>
                    )}
                  </div>
                  {enrolment && enrolment.status !== 'active' && (
                    <div className="tiny muted mt-1">Status: {enrolment.status}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
