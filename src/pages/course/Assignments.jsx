import { Link } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAuth } from '../../state/AuthContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, ProgressBar } from '../../components/ui'
import { formatDateTime, timeAgo } from '../../lib/helpers'

export default function Assignments() {
  const { course } = useCourse()
  const { user } = useAuth()

  const { data, loading } = useAsync(async () => {
    const assignments = (await backend.listAssignments(course.$id)).filter((a) => a.isPublished)
    const rows = await Promise.all(
      assignments.map(async (a) => ({
        assignment: a,
        submission: await backend.mySubmission(a.$id),
      }))
    )
    return rows
  }, [course.$id, user.$id])

  if (loading) return <Spinner />

  const rows = data || []

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>Assignments</h1>
        <div className="muted small">Submit your work before the deadline. Your instructor's feedback appears here.</div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty icon="clipboard" title="No assignments yet">Your instructor hasn't posted any assignments for this course.</Empty></div>
      ) : (
        <div className="card">
          {rows.map(({ assignment, submission }) => {
            const late = assignment.dueAt && new Date(assignment.dueAt).getTime() < Date.now()
            return (
              <div className="class-row" key={assignment.$id} style={{ alignItems: 'flex-start' }}>
                <div className="class-row__main">
                  <div className="row row--between">
                    <h4>{assignment.title}</h4>
                    <div className="row" style={{ gap: 6 }}>
                      {!submission && <Badge tone={late ? 'danger' : 'warn'}>{late ? 'Overdue' : 'Not submitted'}</Badge>}
                      {submission?.status === 'submitted' && <Badge tone="info">Submitted</Badge>}
                      {submission?.status === 'graded' && <Badge tone="ok">Graded</Badge>}
                      {submission?.status === 'returned' && <Badge tone="ok">Returned</Badge>}
                    </div>
                  </div>
                  <div className="meta">
                    {assignment.dueAt
                      ? <>Due {formatDateTime(assignment.dueAt)} · {timeAgo(assignment.dueAt)} · </>
                      : <>No deadline · </>}
                    {assignment.maxScore} marks
                  </div>

                  {submission?.score !== null && submission?.score !== undefined && (
                    <div className="mt-1" style={{ maxWidth: 260 }}>
                      <div className="row row--between tiny muted mb-1">
                        <span>Score</span>
                        <span className="b">{submission.score}/{assignment.maxScore}</span>
                      </div>
                      <ProgressBar value={(submission.score / assignment.maxScore) * 100} />
                    </div>
                  )}
                </div>
                <Link className="btn btn--sm" to={`/courses/${course.slug}/assignments/${assignment.$id}`}>
                  {submission ? 'View' : 'Open'} <Icon name="right" size={14} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
