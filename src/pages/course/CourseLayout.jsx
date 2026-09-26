import { Outlet, useParams, Link, NavLink } from 'react-router-dom'
import Layout from '../../components/Layout'
import { CourseProvider, useCourse } from '../../state/CourseContext'
import { useAuth } from '../../state/AuthContext'
import { Icon, Badge } from '../../components/ui'
import { classWindow } from '../../lib/helpers'
import { useAsync, useTicker } from '../../lib/useAsync'
import backend from '../../lib/backend'

const NAV = [
  { key: '', label: 'Overview', icon: 'home' },
  { key: 'classes', label: 'Live classes', icon: 'video' },
  { key: 'assignments', label: 'Assignments', icon: 'clipboard' },
  { key: 'assessments', label: 'Tests & exams', icon: 'quiz' },
  { key: 'announcements', label: 'Announcements', icon: 'bell' },
  { key: 'chat', label: 'Class chat', icon: 'chat' },
  { key: 'recordings', label: 'Recordings', icon: 'play' },
  { key: 'progress', label: 'My progress', icon: 'chart' },
]

function Inner() {
  const { course, canManage } = useCourse()
  const { user } = useAuth()
  const { courseId } = useParams()
  useTicker(30000)

  const { data } = useAsync(async () => {
    const classes = await backend.listClasses(course.$id)
    const live = classes.find((c) => classWindow(c).canJoin)
    return { live }
  }, [course.$id])

  const base = `/courses/${courseId}`

  const items = NAV.map((n) => ({
    to: n.key ? `${base}/${n.key}` : base,
    label: n.label,
    icon: n.icon,
    end: !n.key,
  }))

  if (canManage) {
    items.push({ to: `/instructor/courses/${course.$id}`, label: 'Manage course', icon: 'cog' })
  }

  return (
    <Layout
      title={course.title}
      courseNav={items.map((i) => ({ ...i, end: i.end }))}
    >
      <CourseBanner course={course} live={data?.live} />
      <Outlet />
    </Layout>
  )
}

function CourseBanner({ course, live }) {
  if (!live) return null
  return (
    <div className="banner">
      <div className="banner__text">
        <h3><span className="dot pulse" style={{ marginRight: 8 }} />Classroom is open — {live.title}</h3>
        <p>Your class is running now. Join and your attendance is recorded automatically.</p>
      </div>
      <Link className="btn btn--lg" style={{ background: '#fff', color: '#b91c1c', borderColor: 'transparent' }}
        to={`/courses/${course.slug}/classes/${live.$id}/join`}>
        <Icon name="play" size={16} /> Join class now
      </Link>
    </div>
  )
}

export default function CourseLayout() {
  return (
    <CourseProvider>
      <Inner />
    </CourseProvider>
  )
}
