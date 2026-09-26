import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import backend from '../lib/backend'
import { useAuth } from './AuthContext'
import { Icon, Spinner } from '../components/ui'

const CourseContext = createContext(null)

/**
 * Loads the course and decides whether the current user may open it.
 *
 *   admin       -> every course
 *   instructor  -> the courses they teach
 *   student     -> ONLY courses they have an ACTIVE enrolment for
 *
 * Anyone else is stopped here, before a single piece of course content
 * is ever fetched — so a non-enrolled student never sees the Zoom link.
 */
export function CourseProvider({ children }) {
  const { courseId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState({ loading: true, course: null, enrolment: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let alive = true
    if (!user || !courseId) return
    setState((s) => ({ ...s, loading: true }))

    ;(async () => {
      try {
        const course = await backend.getCourse(courseId)
        const isStaff = user.role === 'admin' || (user.role === 'instructor' && course.instructorId === user.$id)
        const enrolment = user.role === 'student' ? await backend.myEnrolment(course.$id) : null

        let allowed = false
        let reason = ''

        if (user.role === 'admin') {
          allowed = true
        } else if (user.role === 'instructor') {
          allowed = course.instructorId === user.$id
          if (!allowed) reason = 'You are not the instructor for this course.'
        } else {
          allowed = enrolment?.status === 'active'
          if (!allowed) {
            reason = enrolment?.status === 'suspended'
              ? 'Your enrolment for this course has been suspended. Please contact your administrator.'
              : enrolment?.status === 'pending'
                ? 'Your enrolment for this course is still awaiting approval.'
                : `You are not registered for "${course.title}". Only courses you are registered for can be opened.`
          }
        }

        if (!alive) return
        setState({ loading: false, course, enrolment, allowed, reason, isStaff, canManage: allowed && isStaff, error: null })
      } catch (err) {
        if (!alive) return
        setState({ loading: false, course: null, enrolment: null, allowed: false, error: err.message || 'Course not found.' })
      }
    })()

    return () => { alive = false }
  }, [courseId, user, reloadKey])

  const value = { ...state, reload }

  if (state.loading) return <Spinner label="Opening course…" />

  if (state.error || !state.course) {
    return (
      <div className="content">
        <div className="card"><div className="card__body">
          <div className="row" style={{ gap: 14 }}>
            <span style={{ color: 'var(--danger)' }}><Icon name="alert" size={26} /></span>
            <div style={{ flex: 1 }}>
              <h3>We couldn't open that course</h3>
              <p className="muted mb-0">{state.error || 'It may have been deleted, or the link is wrong.'}</p>
            </div>
            <Link className="btn" to="/student">Back to my courses</Link>
          </div>
        </div></div>
      </div>
    )
  }

  if (!state.allowed) {
    return (
      <div className="content" style={{ maxWidth: 620, margin: '60px auto 0' }}>
        <div className="card">
          <div className="card__body" style={{ textAlign: 'center', padding: '38px 28px' }}>
            <div style={{ color: 'var(--danger)', marginBottom: 12 }}><Icon name="lock" size={44} /></div>
            <h2 style={{ marginBottom: 8 }}>Access denied</h2>
            <p className="muted" style={{ maxWidth: 420, margin: '0 auto 6px' }}>{state.reason}</p>
            <p className="muted small">
              {user?.role === 'student'
                ? 'Students can only open the courses they are registered for. If you think this is a mistake, contact your administrator.'
                : 'You do not have permission to manage this course.'}
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
              <button className="btn" onClick={() => navigate(-1)}>Go back</button>
              <Link className="btn btn--primary" to={user?.role === 'instructor' ? '/instructor' : '/student'}>
                {user?.role === 'instructor' ? 'My courses' : 'My courses'}
              </Link>
              {user?.role === 'student' && <Link className="btn" to="/student/catalog">Browse catalogue</Link>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
}

export function useCourse() {
  const ctx = useContext(CourseContext)
  if (!ctx) throw new Error('useCourse must be used inside <CourseProvider>')
  return ctx
}
