import { useState, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Alert, Badge, StatusBadge } from '../../components/ui'
import ClassesTab from './tabs/ClassesTab'
import AssignmentsTab from './tabs/AssignmentsTab'
import QuestionsTab from './tabs/QuestionsTab'
import TestsTab from './tabs/TestsTab'
import ContentTab from './tabs/ContentTab'
import PeopleTab from './tabs/PeopleTab'

const TABS = [
  { key: 'classes', label: 'Classes', icon: 'video' },
  { key: 'assignments', label: 'Assignments', icon: 'clipboard' },
  { key: 'questions', label: 'Question bank', icon: 'help' },
  { key: 'tests', label: 'Tests & exams', icon: 'quiz' },
  { key: 'content', label: 'Announcements & recordings', icon: 'bell' },
  { key: 'people', label: 'Students & gradebook', icon: 'users' },
]

export default function Manage() {
  const { courseId } = useParams()
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'classes')

  useEffect(() => {
    const t = params.get('tab')
    if (t && TABS.some((x) => x.key === t)) setTab(t)
  }, [params])

  const { data: course, loading, error } = useAsync(() => backend.getCourse(courseId), [courseId])

  if (loading) return <Layout title="Manage course"><Spinner /></Layout>
  if (error || !course) {
    return (
      <Layout title="Manage course">
        <Alert tone="danger">{error?.message || 'Course not found.'}</Alert>
        <Link className="btn mt-2" to="/instructor/courses">Back to my courses</Link>
      </Layout>
    )
  }

  const allowed = isAdmin || course.instructorId === user.$id
  if (!allowed) {
    return (
      <Layout title="Manage course">
        <Alert tone="danger" title="Not your course">You are not the instructor for this course.</Alert>
        <Link className="btn mt-2" to="/instructor/courses">Back to my courses</Link>
      </Layout>
    )
  }

  function switchTab(key) {
    setTab(key)
    setParams({ tab: key }, { replace: true })
  }

  return (
    <Layout title={`${course.title} — manage`}>
      <div className="row row--between mb-2">
        <div>
          <h1 style={{ marginBottom: 4 }}>{course.title}</h1>
          <div className="muted small row" style={{ gap: 10 }}>
            <span className="mono">{course.code}</span>
            <StatusBadge status={course.status} />
            <Link to={`/courses/${course.slug}`}>View as a student <Icon name="right" size={13} /></Link>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => switchTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'classes' && <ClassesTab course={course} />}
      {tab === 'assignments' && <AssignmentsTab course={course} />}
      {tab === 'questions' && <QuestionsTab course={course} />}
      {tab === 'tests' && <TestsTab course={course} />}
      {tab === 'content' && <ContentTab course={course} />}
      {tab === 'people' && <PeopleTab course={course} />}
    </Layout>
  )
}
