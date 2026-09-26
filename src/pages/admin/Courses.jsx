import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Badge, PageHead, StatusBadge, ConfirmButton, Empty } from '../../components/ui'

export default function AdminCourses() {
  const toast = useToast()

  const { data, loading, reload } = useAsync(async () => {
    const [courses, users] = await Promise.all([backend.listCourses(), backend.listUsers()])
    const enrolments = await backend.listEnrolments()
    const rows = courses.map((c) => ({
      course: c,
      students: enrolments.filter((e) => e.courseId === c.$id && e.status === 'active').length,
    }))
    return { rows, instructors: users.filter((u) => u.role === 'instructor' || u.role === 'admin') }
  }, [])

  async function setField(course, patch) {
    try {
      await backend.updateCourse(course.$id, patch)
      toast.success('Course updated.')
      reload()
    } catch (err) { toast.error(err.message) }
  }

  async function remove(course) {
    try { await backend.deleteCourse(course.$id); toast.success('Course deleted.'); reload() }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Layout title="Courses"><Spinner /></Layout>

  const { rows = [], instructors = [] } = data || {}

  return (
    <Layout title="Courses">
      <PageHead title="Courses" subtitle="Every course in the portal, across all instructors.">
        <Link className="btn btn--primary" to="/instructor/courses"><Icon name="plus" size={15} /> New course</Link>
      </PageHead>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon="book" title="No courses yet"
            action={<Link className="btn btn--primary" to="/instructor/courses">Create a course</Link>}>
            Courses hold classes, assignments, tests and everything students use.
          </Empty>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th><th>Instructor</th><th className="num">Students</th>
                  <th>Status</th><th>Open?</th><th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ course, students }) => (
                  <tr key={course.$id}>
                    <td>
                      <div className="b">{course.title}</div>
                      <div className="tiny muted mono">{course.code} · /{course.slug}</div>
                    </td>
                    <td>
                      <select value={course.instructorId || ''} onChange={(e) => setField(course, { instructorId: e.target.value })}
                        style={{ width: 'auto', padding: '5px 8px', fontSize: '.82rem' }}>
                        <option value="">— unassigned —</option>
                        {instructors.map((u) => <option key={u.$id} value={u.$id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="num b">{students}</td>
                    <td>
                      <select value={course.status} onChange={(e) => setField(course, { status: e.target.value })}
                        style={{ width: 'auto', padding: '5px 8px', fontSize: '.82rem' }}>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td>
                      <label className="check" style={{ justifyContent: 'center' }}>
                        <input type="checkbox" checked={!!course.enrollmentOpen}
                          onChange={(e) => setField(course, { enrollmentOpen: e.target.checked })} />
                      </label>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <Link className="btn btn--sm" to={`/instructor/courses/${course.$id}`}>Manage</Link>
                        <ConfirmButton onConfirm={() => remove(course)} confirmLabel="Delete course?"
                          className="btn btn--sm btn--ghost">
                          <Icon name="trash" size={13} />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card mt-3">
        <div className="card__body small muted">
          <b>Tip:</b> “Open?” controls whether students can enrol themselves with the course code. You can always enrol
          someone manually from the <Link to="/admin/enrolments">Enrolments</Link> page, even when a course is closed.
        </div>
      </div>
    </Layout>
  )
}
