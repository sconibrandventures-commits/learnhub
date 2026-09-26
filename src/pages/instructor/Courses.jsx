import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../state/AuthContext'
import { useToast } from '../../state/ToastContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, Modal, PageHead, StatusBadge, ConfirmButton } from '../../components/ui'
import { slugify } from '../../lib/helpers'

const BLANK = {
  title: '', code: '', description: '', category: '', level: 'beginner',
  status: 'published', passMark: 50, enrollmentOpen: true,
}

export default function InstructorCourses() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data, loading, reload } = useAsync(async () => {
    const courses = await backend.listCourses()
    const mine = isAdmin ? courses : courses.filter((c) => c.instructorId === user.$id)
    const rows = await Promise.all(
      mine.map(async (c) => {
        const [enrolments, classes] = await Promise.all([
          backend.listEnrolments({ courseId: c.$id }),
          backend.listClasses(c.$id),
        ])
        return { course: c, students: enrolments.filter((e) => e.status === 'active').length, classes: classes.length }
      })
    )
    return rows
  }, [user.$id, isAdmin])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function openCreate() {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  function openEdit(course) {
    setEditing(course)
    setForm({
      title: course.title, code: course.code, description: course.description || '',
      category: course.category || '', level: course.level || 'beginner',
      status: course.status || 'draft', passMark: course.passMark ?? 50,
      enrollmentOpen: course.enrollmentOpen ?? true,
    })
    setOpen(true)
  }

  async function save(e) {
    e?.preventDefault()
    if (!form.title.trim()) return toast.error('Give the course a title.')
    setBusy(true)
    try {
      if (editing) {
        await backend.updateCourse(editing.$id, { ...form, passMark: Number(form.passMark) })
        toast.success('Course updated.')
      } else {
        await backend.createCourse({ ...form, passMark: Number(form.passMark) })
        toast.success('Course created. Add classes and content from the course page.')
      }
      setOpen(false)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(course) {
    try {
      await backend.deleteCourse(course.$id)
      toast.success('Course deleted.')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <Layout title="My courses"><Spinner /></Layout>

  return (
    <Layout title="My courses">
      <PageHead title="My courses" subtitle="Create courses, then schedule classes and add content.">
        <button className="btn btn--primary" onClick={openCreate}><Icon name="plus" size={15} /> New course</button>
      </PageHead>

      {(data || []).length === 0 ? (
        <div className="card">
          <Empty icon="book" title="No courses yet"
            action={<button className="btn btn--primary" onClick={openCreate}>Create your first course</button>}>
            A course holds your classes, assignments, tests and everything else your students will use.
          </Empty>
        </div>
      ) : (
        <div className="grid grid--3">
          {(data || []).map(({ course, students, classes }) => (
            <div className="course-card" key={course.$id}>
              <div className="course-card__top" style={course.status === 'draft' ? { background: 'var(--line-2)' } : undefined} />
              <div className="course-card__body">
                <div className="row row--between mb-1">
                  <h3>{course.title}</h3>
                  <StatusBadge status={course.status} />
                </div>
                <div className="course-card__meta">
                  <span className="mono">{course.code || 'no code'}</span> · {students} students · {classes} classes
                </div>
                <p className="course-card__desc">{course.description}</p>
                <div className="course-card__foot">
                  <Link className="btn btn--primary" style={{ flex: 1 }} to={`/instructor/courses/${course.$id}`}>
                    Manage
                  </Link>
                  <Link className="btn" to={`/courses/${course.slug}`} title="View as a student">
                    <Icon name="right" size={15} />
                  </Link>
                  <button className="btn btn--sm" onClick={() => openEdit(course)} title="Edit">
                    <Icon name="edit" size={14} />
                  </button>
                </div>
                <div className="row mt-1">
                  <ConfirmButton onConfirm={() => remove(course)} confirmLabel="Delete course?"
                    className="btn btn--sm btn--ghost" danger>
                    <Icon name="trash" size={13} /> Delete
                  </ConfirmButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title={editing ? 'Edit course' : 'Create a course'}
          onClose={() => setOpen(false)}
          width={640}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
              </button>
            </>
          }
        >
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="title">Course title</label>
              <input id="title" type="text" value={form.title} onChange={set('title')} placeholder="Practical Web Development" required />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="code">Enrolment code</label>
                <input id="code" type="text" value={form.code} onChange={set('code')} placeholder="WEB-101" />
                <div className="hint">Students can join with this code.</div>
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <input id="category" type="text" value={form.category} onChange={set('category')} placeholder="Web Development" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea id="description" value={form.description} onChange={set('description')}
                placeholder="What will students learn?" style={{ minHeight: 90 }} />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="level">Level</label>
                <select id="level" value={form.level} onChange={set('level')}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" value={form.status} onChange={set('status')}>
                  <option value="published">Published — visible to students</option>
                  <option value="draft">Draft — hidden</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="passMark">Pass mark (%)</label>
                <input id="passMark" type="number" min="0" max="100" value={form.passMark} onChange={set('passMark')} />
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={form.enrollmentOpen} onChange={set('enrollmentOpen')} />
              Students can enrol themselves in this course
            </label>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
