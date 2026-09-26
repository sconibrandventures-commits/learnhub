import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, homeFor } from './state/AuthContext'
import { Spinner } from './components/ui'

import { Login, Register } from './pages/Auth'
import Profile from './pages/Profile'
import MyCourses from './pages/student/MyCourses'
import Catalog from './pages/student/Catalog'

import CourseLayout from './pages/course/CourseLayout'
import CourseHome from './pages/course/CourseHome'
import Classes from './pages/course/Classes'
import ClassJoin from './pages/course/ClassJoin'
import Assignments from './pages/course/Assignments'
import AssignmentView from './pages/course/AssignmentView'
import Assessments from './pages/course/Assessments'
import AssessmentStart from './pages/course/AssessmentStart'
import AssessmentTake from './pages/course/AssessmentTake'
import { default as AssessmentResult, AssessmentHistory } from './pages/course/AssessmentResult'
import Announcements from './pages/course/Announcements'
import Chat from './pages/course/Chat'
import Recordings from './pages/course/Recordings'
import Progress from './pages/course/Progress'

import InstructorDashboard from './pages/instructor/Dashboard'
import InstructorCourses from './pages/instructor/Courses'
import Manage from './pages/instructor/Manage'

import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminCourses from './pages/admin/Courses'
import AdminEnrolments from './pages/admin/Enrolments'

/* ------------------------------------------------------------- guards */

function RequireAuth({ children }) {
  const { isAuthed, loading, user } = useAuth()
  const location = useLocation()

  if (loading) return <div className="center-load" style={{ minHeight: '100vh' }}><Spinner label="Loading…" /></div>
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (location.pathname === '/' || location.pathname === '') return <Navigate to={homeFor(user.role)} replace />
  return children
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) return <Navigate to={homeFor(user?.role)} replace />
  return children
}

function GuestOnly({ children }) {
  const { isAuthed, loading, user } = useAuth()
  if (loading) return <div className="center-load" style={{ minHeight: '100vh' }}><Spinner label="Loading…" /></div>
  if (isAuthed) return <Navigate to={homeFor(user.role)} replace />
  return children
}

function NotFound() {
  return (
    <div className="center-load" style={{ minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem' }}>404</h1>
        <p className="muted">That page doesn't exist.</p>
        <a className="btn btn--primary" href="/">Back to the portal</a>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- routes */

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      {/* Student area */}
      <Route path="/student" element={<RequireAuth><RequireRole roles={['student']}><MyCourses /></RequireRole></RequireAuth>} />
      <Route path="/student/catalog" element={<RequireAuth><RequireRole roles={['student']}><Catalog /></RequireRole></RequireAuth>} />

      {/* Course space — access is checked inside CourseProvider */}
      <Route path="/courses/:courseId" element={<RequireAuth><CourseLayout /></RequireAuth>}>
        <Route index element={<CourseHome />} />
        <Route path="classes" element={<Classes />} />
        <Route path="classes/:classId/join" element={<ClassJoin />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:assignmentId" element={<AssignmentView />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="assessments/:assessmentId" element={<AssessmentStart />} />
        <Route path="assessments/:assessmentId/take/:attemptId" element={<AssessmentTake />} />
        <Route path="assessments/:assessmentId/result/:attemptId" element={<AssessmentResult />} />
        <Route path="assessments/:assessmentId/history" element={<AssessmentHistory />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="chat" element={<Chat />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="progress" element={<Progress />} />
      </Route>

      {/* Instructor area */}
      <Route path="/instructor" element={<RequireAuth><RequireRole roles={['instructor', 'admin']}><InstructorDashboard /></RequireRole></RequireAuth>} />
      <Route path="/instructor/courses" element={<RequireAuth><RequireRole roles={['instructor', 'admin']}><InstructorCourses /></RequireRole></RequireAuth>} />
      <Route path="/instructor/courses/:courseId" element={<RequireAuth><RequireRole roles={['instructor', 'admin']}><Manage /></RequireRole></RequireAuth>} />

      {/* Admin area */}
      <Route path="/admin" element={<RequireAuth><RequireRole roles={['admin']}><AdminDashboard /></RequireRole></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><RequireRole roles={['admin']}><AdminUsers /></RequireRole></RequireAuth>} />
      <Route path="/admin/courses" element={<RequireAuth><RequireRole roles={['admin']}><AdminCourses /></RequireRole></RequireAuth>} />
      <Route path="/admin/enrolments" element={<RequireAuth><RequireRole roles={['admin']}><AdminEnrolments /></RequireRole></RequireAuth>} />

      {/* Profile (any signed-in user) */}
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

      {/* Home + catch-all */}
      <Route path="/" element={<RequireAuth><Navigate to="/student" replace /></RequireAuth>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
