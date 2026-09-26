import { Link } from 'react-router-dom'
import { useCourse } from '../../state/CourseContext'
import { useAsync } from '../../lib/useAsync'
import backend from '../../lib/backend'
import { Icon, Spinner, Empty, Badge, ProgressBar, Stat } from '../../components/ui'
import { formatDateTime, formatDate } from '../../lib/helpers'

export default function Progress() {
  const { course } = useCourse()
  const { data, loading } = useAsync(() => backend.getProgress(course.$id), [course.$id])

  if (loading) return <Spinner />
  if (!data) return null

  const { attendance, assignments, assessments } = data
  const gradedScores = assignments.rows.filter((r) => r.submission?.score !== null && r.submission?.score !== undefined)
  const avgAssignment = gradedScores.length
    ? Math.round(gradedScores.reduce((s, r) => s + (r.submission.score / r.assignment.maxScore) * 100, 0) / gradedScores.length)
    : null
  const assessmentScores = assessments.filter((a) => a.best).map((a) => a.best.percentage)
  const avgAssessment = assessmentScores.length
    ? Math.round(assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length)
    : null

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>My progress</h1>
        <div className="muted small">How you're doing in {course.title}.</div>
      </div>

      <div className="grid grid--4">
        <Stat label="Attendance" value={`${attendance.rate}%`} hint={`${attendance.attended} of ${attendance.total} classes`} />
        <Stat label="Assignments" value={`${assignments.submitted}/${assignments.total}`} hint={`${assignments.graded} graded`} />
        <Stat label="Avg. assignment" value={avgAssignment === null ? '—' : `${avgAssignment}%`} hint={avgAssignment === null ? 'nothing graded yet' : 'across graded work'} />
        <Stat label="Avg. test score" value={avgAssessment === null ? '—' : `${avgAssessment}%`} hint={avgAssessment === null ? 'nothing attempted yet' : 'best attempt each'} />
      </div>

      {/* Attendance */}
      <div className="card">
        <div className="card__head">
          <h3><Icon name="video" size={16} /> Attendance</h3>
          <Badge tone={attendance.rate >= 70 ? 'ok' : attendance.rate >= 40 ? 'warn' : 'danger'}>{attendance.rate}%</Badge>
        </div>
        <div className="card__body">
          <ProgressBar value={attendance.rate} />
          {attendance.records.length === 0 ? (
            <div className="muted small mt-2">You haven't attended any classes yet.</div>
          ) : (
            <div className="table-wrap mt-2">
              <table>
                <thead>
                  <tr><th>Class</th><th>Date</th><th className="num">Minutes present</th></tr>
                </thead>
                <tbody>
                  {attendance.records.map((r) => (
                    <tr key={r.$id}>
                      <td>{r.liveClass?.title || 'Class'}</td>
                      <td className="small muted">{r.liveClass ? formatDate(r.liveClass.startsAt) : '—'}</td>
                      <td className="num">{r.minutesPresent || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assignments */}
      <div className="card">
        <div className="card__head"><h3><Icon name="clipboard" size={16} /> Assignments</h3></div>
        <div className="card__body">
          {assignments.rows.length === 0 ? (
            <div className="muted small">No assignments in this course yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Assignment</th><th>Due</th><th>Status</th><th className="num">Score</th></tr>
                </thead>
                <tbody>
                  {assignments.rows.map(({ assignment, submission }) => (
                    <tr key={assignment.$id}>
                      <td>
                        <Link to={`/courses/${course.slug}/assignments/${assignment.$id}`}>{assignment.title}</Link>
                      </td>
                      <td className="small muted">{assignment.dueAt ? formatDateTime(assignment.dueAt) : '—'}</td>
                      <td>
                        {!submission && <Badge tone="warn">Not submitted</Badge>}
                        {submission?.status === 'submitted' && <Badge tone="info">Submitted</Badge>}
                        {submission?.status === 'graded' && <Badge tone="ok">Graded</Badge>}
                        {submission?.status === 'returned' && <Badge tone="ok">Returned</Badge>}
                      </td>
                      <td className="num b">
                        {submission?.score !== null && submission?.score !== undefined
                          ? `${submission.score}/${assignment.maxScore}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assessments */}
      <div className="card">
        <div className="card__head"><h3><Icon name="quiz" size={16} /> Tests &amp; exams</h3></div>
        <div className="card__body">
          {assessments.length === 0 ? (
            <div className="muted small">No assessments in this course yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Assessment</th><th>Type</th><th className="num">Attempts</th><th className="num">Best score</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {assessments.map(({ assessment, attempts: n, best }) => (
                    <tr key={assessment.$id}>
                      <td>
                        <Link to={`/courses/${course.slug}/assessments/${assessment.$id}`}>{assessment.title}</Link>
                      </td>
                      <td><Badge tone={assessment.type === 'exam' ? 'danger' : 'brand'}>{assessment.type}</Badge></td>
                      <td className="num">{n}</td>
                      <td className="num b">{best ? `${best.score}/${best.total} (${best.percentage}%)` : '—'}</td>
                      <td>
                        {best
                          ? <Badge tone={best.passed ? 'ok' : 'danger'}>{best.passed ? 'Passed' : 'Failed'}</Badge>
                          : <span className="muted small">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
