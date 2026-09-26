/**
 * Demo backend — a complete, working fake of the Appwrite backend that lives
 * entirely in the browser (localStorage).
 *
 * It implements exactly the same interface as realBackend.js, so the whole
 * application works without any server. Flip VITE_DEMO_MODE=false and fill in
 * your Appwrite credentials and the app switches to the real thing with no
 * other changes.
 */
import { uid, slugify, classWindow, isAssessmentOpen } from './helpers'

const STORAGE_KEY = 'learnhub.demo.v3'
const SESSION_KEY = 'learnhub.demo.session.v3'

/* ----------------------------------------------------------- persistence */

let db = null

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (e) {
    /* storage full or unavailable — demo keeps working in memory */
  }
}

function load() {
  if (db) return db
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      db = JSON.parse(raw)
      return db
    }
  } catch (e) {
    /* corrupted — fall through and re-seed */
  }
  db = seed()
  persist()
  return db
}

const wait = (ms = 45) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => JSON.parse(JSON.stringify(x))

/* ------------------------------------------------------------------ seed */

function seed() {
  const now = Date.now()
  const H = 3600000
  const D = 86400000

  const admin = {
    $id: 'u_admin', name: 'Portal Administrator', email: 'admin@learnhub.test',
    role: 'admin', isActive: true, createdAt: new Date(now - 30 * D).toISOString(),
  }
  const teacher = {
    $id: 'u_teacher', name: 'Mr. Emeka Obi', email: 'teacher@learnhub.test',
    role: 'instructor', isActive: true, createdAt: new Date(now - 28 * D).toISOString(),
  }
  const mkStudent = (id, name, email, days) => ({
    $id: id, name, email, role: 'student', isActive: true,
    createdAt: new Date(now - days * D).toISOString(),
  })
  const ngozi = mkStudent('u_ngozi', 'Ngozi Adeyemi', 'ngozi@learnhub.test', 14)
  const tunde = mkStudent('u_tunde', 'Tunde Bakare', 'tunde@learnhub.test', 12)
  const ibrahim = mkStudent('u_ibrahim', 'Ibrahim Musa', 'ibrahim@learnhub.test', 10)

  const web = {
    $id: 'c_web', teamId: 'team_web', title: 'Practical Web Development',
    slug: 'practical-web-development', code: 'WEB-101',
    description:
      'Learn to build real websites from scratch. HTML, CSS, JavaScript and how to put a site online. Every class is live on Zoom and recorded.',
    instructorId: teacher.$id, category: 'Web Development', level: 'beginner',
    status: 'published', passMark: 50, enrollmentOpen: true,
    createdAt: new Date(now - 20 * D).toISOString(),
  }
  const data = {
    $id: 'c_data', teamId: 'team_data', title: 'Data Science Bootcamp',
    slug: 'data-science-bootcamp', code: 'DS-202',
    description:
      'Python, pandas and machine learning. Only some students are registered for this one — use it to watch the enrolment lock in action.',
    instructorId: teacher.$id, category: 'Data', level: 'intermediate',
    status: 'published', passMark: 50, enrollmentOpen: true,
    createdAt: new Date(now - 9 * D).toISOString(),
  }

  const enrol = (userId, courseId, status) => ({
    $id: `e_${userId}_${courseId}`, userId, courseId, status,
    enrolledAt: new Date(now - 10 * D).toISOString(),
    approvedAt: status === 'active' ? new Date(now - 10 * D).toISOString() : null,
    approvedBy: admin.$id,
  })

  const classes = [
    {
      $id: 'cl_1', courseId: web.$id,
      title: 'Week 1 — How the web works',
      description: 'Requests, responses, browsers, servers and DNS. We will build our first page together.',
      startsAt: new Date(now - 10 * 60000).toISOString(), durationMinutes: 90,
      status: 'live',
      zoomMeetingId: '812 3456 7890', zoomPassword: 'web101',
      zoomJoinUrl: 'https://zoom.us/j/81234567890?pwd=demo',
      zoomStartUrl: 'https://zoom.us/s/81234567890?zak=host-only',
      createdBy: teacher.$id,
    },
    {
      $id: 'cl_2', courseId: web.$id,
      title: 'Week 2 — HTML & CSS foundations',
      description: 'Semantic markup, the box model, flexbox and a first responsive layout.',
      startsAt: new Date(now + 6 * D).toISOString(), durationMinutes: 90,
      status: 'scheduled', zoomMeetingId: '823 4567 8901', zoomPassword: 'web101',
      zoomJoinUrl: 'https://zoom.us/j/82345678901?pwd=demo',
      zoomStartUrl: 'https://zoom.us/s/82345678901?zak=host-only',
      createdBy: teacher.$id,
    },
    {
      $id: 'cl_3', courseId: web.$id,
      title: 'Week 0 — Course orientation',
      description: 'Meet your instructor, tour the portal, set up your tools.',
      startsAt: new Date(now - 7 * D).toISOString(), durationMinutes: 60,
      status: 'ended', zoomMeetingId: '801 2345 6789', zoomPassword: 'web101',
      zoomJoinUrl: 'https://zoom.us/j/80123456789?pwd=demo',
      zoomStartUrl: '', createdBy: teacher.$id,
    },
    {
      $id: 'cl_4', courseId: data.$id,
      title: 'Intro to pandas',
      description: 'DataFrames, indexing and group-by operations.',
      startsAt: new Date(now - 5 * 60000).toISOString(), durationMinutes: 120,
      status: 'live', zoomMeetingId: '888 777 6666', zoomPassword: 'secret1',
      zoomJoinUrl: 'https://zoom.us/j/8887776666?pwd=demo',
      zoomStartUrl: 'https://zoom.us/s/8887776666?zak=host-only',
      createdBy: teacher.$id,
    },
  ]

  const assignments = [
    {
      $id: 'a_1', courseId: web.$id,
      title: 'Build a one-page profile',
      description:
        'Create a single HTML page about yourself: a heading, a short paragraph, one image and a link. Use semantic HTML tags. Attach your .html file, or paste your code below.',
      dueAt: new Date(now + 5 * D).toISOString(), maxScore: 20, isPublished: true,
      createdAt: new Date(now - 6 * D).toISOString(),
    },
    {
      $id: 'a_2', courseId: web.$id,
      title: 'Style it with CSS',
      description: 'Take your profile page and add an external stylesheet. Use flexbox for the layout.',
      dueAt: new Date(now + 12 * D).toISOString(), maxScore: 20, isPublished: true,
      createdAt: new Date(now - 2 * D).toISOString(),
    },
  ]

  const questions = [
    {
      $id: 'q_1', courseId: web.$id, type: 'mcq',
      body: 'What does HTML stand for?',
      options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Hyperlink and Text Markup Language', 'Home Tool Markup Language'],
      correctAnswer: 'Hyper Text Markup Language', marks: 1,
      explanation: 'HTML is the Hyper Text Markup Language — the standard markup language for web pages.',
    },
    {
      $id: 'q_2', courseId: web.$id, type: 'mcq',
      body: 'Which HTTP status code means "Not Found"?',
      options: ['200', '301', '404', '500'],
      correctAnswer: '404', marks: 1,
      explanation: '404 Not Found. 200 is OK, 301 is a redirect, 500 is a server error.',
    },
    {
      $id: 'q_3', courseId: web.$id, type: 'true_false',
      body: 'CSS is responsible for the structure and content of a web page.',
      options: ['True', 'False'], correctAnswer: 'False', marks: 1,
      explanation: 'False — HTML provides structure and content; CSS handles presentation.',
    },
    {
      $id: 'q_4', courseId: web.$id, type: 'mcq',
      body: 'Which of these is NOT a valid way to declare a variable in modern JavaScript?',
      options: ['let', 'const', 'var', 'define'],
      correctAnswer: 'define', marks: 1,
      explanation: 'let, const and var are all valid. "define" is not a JavaScript keyword.',
    },
    {
      $id: 'q_5', courseId: web.$id, type: 'short_answer',
      body: 'In one sentence, explain what DNS does when you type a web address into your browser.',
      options: [], correctAnswer: '', marks: 2,
      explanation: 'DNS translates a human-friendly domain name into the IP address of the server hosting the site.',
    },
    {
      $id: 'q_6', courseId: web.$id, type: 'mcq',
      body: 'Which CSS property creates space INSIDE an element, between its content and its border?',
      options: ['margin', 'padding', 'border-spacing', 'gap'],
      correctAnswer: 'padding', marks: 1,
      explanation: 'padding is the inner space. margin is the outer space, outside the border.',
    },
  ]

  const assessments = [
    {
      $id: 'as_1', courseId: web.$id, title: 'Week 1 Knowledge Check',
      type: 'test',
      instructions: 'Five quick questions covering this week\'s class. You have 15 minutes. Good luck!',
      startsAt: null, endsAt: new Date(now + 30 * D).toISOString(),
      durationMinutes: 15, maxAttempts: 2, passMark: 50,
      shuffleQuestions: true, showResults: true, isPublished: true,
      totalMarks: 6, createdAt: new Date(now - 5 * D).toISOString(),
    },
    {
      $id: 'as_2', courseId: web.$id, title: 'Mid-term Examination',
      type: 'exam',
      instructions: 'This exam covers weeks 1 to 6. It is timed and you may not pause it once started.',
      startsAt: new Date(now + 20 * D).toISOString(),
      endsAt: new Date(now + 21 * D).toISOString(),
      durationMinutes: 60, maxAttempts: 1, passMark: 50,
      shuffleQuestions: false, showResults: false, isPublished: true,
      totalMarks: 3, createdAt: new Date(now - 3 * D).toISOString(),
    },
  ]

  const assessmentQuestions = [
    { $id: 'aq_1', assessmentId: 'as_1', questionId: 'q_1', position: 1, marks: 1 },
    { $id: 'aq_2', assessmentId: 'as_1', questionId: 'q_2', position: 2, marks: 1 },
    { $id: 'aq_3', assessmentId: 'as_1', questionId: 'q_3', position: 3, marks: 1 },
    { $id: 'aq_4', assessmentId: 'as_1', questionId: 'q_4', position: 4, marks: 1 },
    { $id: 'aq_5', assessmentId: 'as_1', questionId: 'q_5', position: 5, marks: 2 },
    { $id: 'aq_6', assessmentId: 'as_2', questionId: 'q_2', position: 1, marks: 1 },
    { $id: 'aq_7', assessmentId: 'as_2', questionId: 'q_6', position: 2, marks: 1 },
    { $id: 'aq_8', assessmentId: 'as_2', questionId: 'q_3', position: 3, marks: 1 },
  ]

  const announcements = [
    {
      $id: 'an_1', courseId: web.$id, title: 'Welcome to the course!',
      body: 'Welcome to Practical Web Development.\n\nWe meet live every week — the Join button appears 15 minutes before the class starts. If you miss a class, the recording will be in Recordings within 24 hours.\n\nBring questions to the chat.\n\n— Mr. Obi',
      isPinned: true, authorId: teacher.$id, publishedAt: new Date(now - 7 * D).toISOString(),
    },
    {
      $id: 'an_2', courseId: web.$id, title: 'Assignment 1 is due next week',
      body: 'Don\'t forget: "Build a one-page profile" is due in five days. Submit before the deadline to avoid a late penalty.',
      isPinned: false, authorId: teacher.$id, publishedAt: new Date(now - 2 * D).toISOString(),
    },
    {
      $id: 'an_3', courseId: data.$id, title: 'Bring your laptop',
      body: 'We will be coding along in class. Make sure Python 3 is installed before the session.',
      isPinned: false, authorId: teacher.$id, publishedAt: new Date(now - 1 * D).toISOString(),
    },
  ]

  const messages = [
    { $id: 'm_1', courseId: web.$id, userId: teacher.$id, body: 'Morning everyone — class starts in 10 minutes!', createdAt: new Date(now - 3 * H).toISOString() },
    { $id: 'm_2', courseId: web.$id, userId: ngozi.$id, body: 'Good morning sir. Will we get the slides afterwards?', createdAt: new Date(now - 2.8 * H).toISOString() },
    { $id: 'm_3', courseId: web.$id, userId: teacher.$id, body: 'Yes — slides and the recording will both be posted.', createdAt: new Date(now - 2.7 * H).toISOString() },
    { $id: 'm_4', courseId: web.$id, userId: tunde.$id, body: 'Thank you!', createdAt: new Date(now - 2.6 * H).toISOString() },
  ]

  const recordings = [
    {
      $id: 'r_1', courseId: web.$id, classId: 'cl_3',
      title: 'Week 0 — Course orientation (recording)',
      description: 'Full recording of the orientation session.',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      durationMinutes: 58, recordedAt: new Date(now - 7 * D).toISOString(), isPublished: true,
    },
    {
      $id: 'r_2', courseId: web.$id, classId: null,
      title: 'Extra: Setting up VS Code',
      description: 'A short walkthrough of the editor setup we recommend.',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      durationMinutes: 14, recordedAt: new Date(now - 4 * D).toISOString(), isPublished: true,
    },
  ]

  const submissions = [
    {
      $id: 's_1', assignmentId: 'a_1', userId: ibrahim.$id,
      body: '<!doctype html>\n<html>\n  <head><title>Ibrahim</title></head>\n  <body>\n    <h1>Ibrahim Musa</h1>\n    <p>Student at LearnHub.</p>\n  </body>\n</html>',
      fileName: null, submittedAt: new Date(now - 2 * D).toISOString(),
      score: 18, feedback: 'Excellent — clean semantic markup. Add an alt attribute to your image next time.',
      status: 'returned', gradedAt: new Date(now - 1 * D).toISOString(), gradedBy: teacher.$id,
    },
    {
      $id: 's_2', assignmentId: 'a_1', userId: ngozi.$id,
      body: 'I have attached my file.',
      fileName: 'profile-ngozi.html', submittedAt: new Date(now - 1 * D).toISOString(),
      score: null, feedback: null, status: 'submitted', gradedAt: null, gradedBy: null,
    },
  ]

  const attempts = [
    {
      $id: 'at_1', assessmentId: 'as_1', userId: ibrahim.$id,
      startedAt: new Date(now - 2 * D).toISOString(),
      submittedAt: new Date(now - 2 * D + 12 * 60000).toISOString(),
      status: 'graded', score: 5, total: 6, percentage: 83.33, passed: true,
      answers: {
        q_1: { answer: 'Hyper Text Markup Language', marks: 1, correct: true },
        q_2: { answer: '404', marks: 1, correct: true },
        q_3: { answer: 'False', marks: 1, correct: true },
        q_4: { answer: 'define', marks: 1, correct: true },
        q_5: { answer: 'DNS turns the domain name into an IP address.', marks: 1, correct: true, needsReview: false },
      },
    },
    {
      $id: 'at_2', assessmentId: 'as_1', userId: tunde.$id,
      startedAt: new Date(now - 1 * D).toISOString(),
      submittedAt: new Date(now - 1 * D + 14 * 60000).toISOString(),
      status: 'graded', score: 3, total: 6, percentage: 50, passed: true,
      answers: {
        q_1: { answer: 'Hyper Text Markup Language', marks: 1, correct: true },
        q_2: { answer: '500', marks: 0, correct: false },
        q_3: { answer: 'True', marks: 0, correct: false },
        q_4: { answer: 'define', marks: 1, correct: true },
        q_5: { answer: 'It loads the website.', marks: 1, correct: true, needsReview: false },
      },
    },
  ]

  return {
    users: [admin, teacher, ngozi, tunde, ibrahim],
    passwords: {
      'admin@learnhub.test': 'password',
      'teacher@learnhub.test': 'password',
      'ngozi@learnhub.test': 'password',
      'tunde@learnhub.test': 'password',
      'ibrahim@learnhub.test': 'password',
    },
    courses: [web, data],
    enrolments: [
      enrol(ngozi.$id, web.$id, 'active'),
      enrol(tunde.$id, web.$id, 'active'),
      enrol(ibrahim.$id, web.$id, 'active'),
      enrol(ngozi.$id, data.$id, 'active'),
      enrol(ibrahim.$id, data.$id, 'active'),
      // Tunde is deliberately NOT enrolled in DS-202 — see the lock in action.
    ],
    classes,
    attendance: [
      { $id: 'atd_1', classId: 'cl_3', userId: ngozi.$id, joinedAt: new Date(now - 7 * D).toISOString(), lastPingAt: new Date(now - 7 * D + 55 * 60000).toISOString(), minutesPresent: 55 },
      { $id: 'atd_2', classId: 'cl_3', userId: tunde.$id, joinedAt: new Date(now - 7 * D).toISOString(), lastPingAt: new Date(now - 7 * D + 40 * 60000).toISOString(), minutesPresent: 40 },
    ],
    assignments,
    submissions,
    questions,
    assessments,
    assessmentQuestions,
    attempts,
    announcements,
    messages,
    recordings,
  }
}

/* --------------------------------------------------------------- helpers */

const byId = (arr, id) => arr.find((x) => x.$id === id)
const sortBy = (arr, key, dir = 'asc') =>
  [...arr].sort((a, b) => (dir === 'desc' ? String(b[key]).localeCompare(String(a[key])) : String(a[key]).localeCompare(String(b[key]))))

function me() {
  const id = localStorage.getItem(SESSION_KEY)
  if (!id) return null
  return byId(load().users, id) || null
}

function setSession(userId) {
  localStorage.setItem(SESSION_KEY, userId)
}

/* ------------------------------------------------------------- the API */

export const demoBackend = {
  isDemo: true,

  /* ------------------------------------------------------------ auth */
  async getSession() {
    await wait(20)
    const u = me()
    return u ? clone(u) : null
  },

  async login(email, password) {
    await wait()
    const d = load()
    const user = d.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())
    if (!user) throw new Error('No account found with that email address.')
    if (password !== d.passwords[user.email]) throw new Error('That password is incorrect.')
    if (!user.isActive) throw new Error('This account has been disabled. Please contact an administrator.')
    setSession(user.$id)
    return clone(user)
  },

  async logout() {
    await wait(20)
    localStorage.removeItem(SESSION_KEY)
  },

  async register({ name, email, password, code }) {
    await wait()
    const d = load()
    if (d.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase()))
      throw new Error('That email address is already registered.')
    const user = {
      $id: uid('u'), name, email, role: 'student', isActive: true,
      createdAt: new Date().toISOString(),
    }
    d.users.push(user)
    d.passwords[user.email] = password

    // Course code given at signup? Enrol immediately.
    if (code) {
      const course = d.courses.find((c) => c.code.toLowerCase() === String(code).toLowerCase())
      if (course) {
        d.enrolments.push({
          $id: uid('e'), userId: user.$id, courseId: course.$id,
          status: course.enrollmentOpen ? 'active' : 'pending',
          enrolledAt: new Date().toISOString(),
          approvedAt: course.enrollmentOpen ? new Date().toISOString() : null,
          approvedBy: null,
        })
      }
    }
    persist()
    setSession(user.$id)
    return clone(user)
  },

  async updateProfile(userId, patch) {
    await wait()
    const d = load()
    const u = byId(d.users, userId)
    if (!u) throw new Error('User not found.')
    if (patch.name !== undefined) u.name = patch.name
    if (patch.email !== undefined) u.email = patch.email
    persist()
    return clone(u)
  },

  async changePassword(userId, currentPassword, newPassword) {
    await wait()
    const d = load()
    const u = byId(d.users, userId)
    if (!u) throw new Error('User not found.')
    if (d.passwords[u.email] !== currentPassword) throw new Error('Your current password is incorrect.')
    d.passwords[u.email] = newPassword
    persist()
    return true
  },

  /* ----------------------------------------------------------- users */
  async listUsers() {
    await wait()
    return sortBy(load().users, 'name')
  },
  async createUser({ name, email, password, role }) {
    await wait()
    const d = load()
    if (d.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase()))
      throw new Error('That email address is already registered.')
    const user = { $id: uid('u'), name, email, role: role || 'student', isActive: true, createdAt: new Date().toISOString() }
    d.users.push(user)
    d.passwords[email] = password
    persist()
    return clone(user)
  },
  async setUserRole(userId, role) {
    await wait()
    const u = byId(load().users, userId)
    if (u) { u.role = role; persist() }
    return clone(u)
  },
  async setUserActive(userId, isActive) {
    await wait()
    const u = byId(load().users, userId)
    if (u) { u.isActive = isActive; persist() }
    return clone(u)
  },
  async deleteUser(userId) {
    await wait()
    const d = load()
    d.users = d.users.filter((u) => u.$id !== userId)
    d.enrolments = d.enrolments.filter((e) => e.userId !== userId)
    persist()
    return true
  },

  /* --------------------------------------------------------- courses */
  async listCourses() {
    await wait()
    const d = load()
    return clone(d.courses).map((c) => ({
      ...c,
      instructor: clone(byId(d.users, c.instructorId)),
    }))
  },

  async getCourse(idOrSlug) {
    await wait(20)
    const d = load()
    const c = d.courses.find((x) => x.$id === idOrSlug || x.slug === idOrSlug)
    if (!c) throw new Error('Course not found.')
    return { ...clone(c), instructor: clone(byId(d.users, c.instructorId)) }
  },

  async myCourseIds() {
    const user = me()
    if (!user) return []
    const d = load()
    if (user.role === 'admin') return d.courses.map((c) => c.$id)
    if (user.role === 'instructor') return d.courses.filter((c) => c.instructorId === user.$id).map((c) => c.$id)
    return d.enrolments.filter((e) => e.userId === user.$id && e.status === 'active').map((e) => e.courseId)
  },

  async createCourse(data) {
    await wait()
    const d = load()
    const course = {
      $id: uid('c'), teamId: `team_${Math.random().toString(36).slice(2, 8)}`,
      title: data.title, slug: slugify(data.title), code: (data.code || '').toUpperCase(),
      description: data.description || '', instructorId: me()?.$id || data.instructorId,
      category: data.category || '', level: data.level || 'beginner',
      status: data.status || 'draft', passMark: data.passMark ?? 50,
      enrollmentOpen: data.enrollmentOpen ?? true,
      createdAt: new Date().toISOString(),
    }
    d.courses.push(course)
    persist()
    return clone(course)
  },

  async updateCourse(id, patch) {
    await wait()
    const c = byId(load().courses, id)
    if (!c) throw new Error('Course not found.')
    Object.assign(c, patch)
    if (patch.title) c.slug = slugify(patch.title)
    persist()
    return clone(c)
  },

  async deleteCourse(id) {
    await wait()
    const d = load()
    d.courses = d.courses.filter((c) => c.$id !== id)
    d.enrolments = d.enrolments.filter((e) => e.courseId !== id)
    persist()
    return true
  },

  /* ------------------------------------------------------ enrolments */
  async listEnrolments({ courseId, userId } = {}) {
    await wait()
    const d = load()
    let rows = d.enrolments
    if (courseId) rows = rows.filter((e) => e.courseId === courseId)
    if (userId) rows = rows.filter((e) => e.userId === userId)
    return clone(rows).map((e) => ({
      ...e,
      user: clone(byId(d.users, e.userId)),
      course: clone(byId(d.courses, e.courseId)),
    }))
  },

  async myEnrolment(courseId) {
    const user = me()
    if (!user) return null
    const d = load()
    const e = d.enrolments.find((x) => x.userId === user.$id && x.courseId === courseId)
    return e ? clone(e) : null
  },

  async enrol({ userId, courseId, status = 'active' }) {
    await wait()
    const d = load()
    let e = d.enrolments.find((x) => x.userId === userId && x.courseId === courseId)
    if (e) {
      e.status = status
    } else {
      e = {
        $id: uid('e'), userId, courseId, status,
        enrolledAt: new Date().toISOString(),
        approvedAt: status === 'active' ? new Date().toISOString() : null,
        approvedBy: me()?.$id || null,
      }
      d.enrolments.push(e)
    }
    persist()
    return clone(e)
  },

  async setEnrolmentStatus(id, status) {
    await wait()
    const d = load()
    const e = byId(d.enrolments, id)
    if (!e) throw new Error('Enrolment not found.')
    e.status = status
    e.approvedAt = status === 'active' ? new Date().toISOString() : e.approvedAt
    e.approvedBy = status === 'active' ? me()?.$id || e.approvedBy : e.approvedBy
    persist()
    return clone(e)
  },

  async removeEnrolment(id) {
    await wait()
    const d = load()
    d.enrolments = d.enrolments.filter((e) => e.$id !== id)
    persist()
    return true
  },

  async joinWithCode(code) {
    await wait()
    const d = load()
    const user = me()
    if (!user) throw new Error('Please sign in first.')
    const course = d.courses.find((c) => c.code.toLowerCase() === String(code).toLowerCase())
    if (!course) throw new Error('That enrolment code is not recognised.')
    if (!course.enrollmentOpen) throw new Error('Enrolment for that course is closed.')
    return this.enrol({ userId: user.$id, courseId: course.$id, status: 'active' })
  },

  /* --------------------------------------------------------- classes */
  async listClasses(courseId) {
    await wait()
    const d = load()
    return sortBy(d.classes.filter((c) => c.courseId === courseId), 'startsAt')
  },

  async getClass(id) {
    await wait(20)
    const c = byId(load().classes, id)
    if (!c) throw new Error('Class not found.')
    return clone(c)
  },

  async createClass(courseId, data) {
    await wait()
    const d = load()
    const cls = {
      $id: uid('cl'), courseId,
      title: data.title, description: data.description || '',
      startsAt: data.startsAt, durationMinutes: Number(data.durationMinutes) || 60,
      status: data.status || 'scheduled',
      zoomMeetingId: data.zoomMeetingId || '', zoomPassword: data.zoomPassword || '',
      zoomJoinUrl: data.zoomJoinUrl || '', zoomStartUrl: data.zoomStartUrl || '',
      createdBy: me()?.$id,
    }
    d.classes.push(cls)
    persist()
    return clone(cls)
  },

  async updateClass(id, patch) {
    await wait()
    const c = byId(load().classes, id)
    if (!c) throw new Error('Class not found.')
    Object.assign(c, patch)
    persist()
    return clone(c)
  },

  async deleteClass(id) {
    await wait()
    const d = load()
    d.classes = d.classes.filter((c) => c.$id !== id)
    d.attendance = d.attendance.filter((a) => a.classId !== id)
    persist()
    return true
  },

  async joinClass(classId) {
    await wait()
    const d = load()
    const user = me()
    if (!user) throw new Error('Please sign in first.')
    let a = d.attendance.find((x) => x.classId === classId && x.userId === user.$id)
    if (!a) {
      a = {
        $id: uid('atd'), classId, userId: user.$id,
        joinedAt: new Date().toISOString(), lastPingAt: new Date().toISOString(), minutesPresent: 0,
      }
      d.attendance.push(a)
    }
    a.lastPingAt = new Date().toISOString()
    a.minutesPresent = Math.round((Date.now() - new Date(a.joinedAt).getTime()) / 60000)
    persist()
    return clone(a)
  },

  async heartbeat(classId) {
    const d = load()
    const user = me()
    if (!user) return null
    const a = d.attendance.find((x) => x.classId === classId && x.userId === user.$id)
    if (!a) return null
    a.lastPingAt = new Date().toISOString()
    a.minutesPresent = Math.round((Date.now() - new Date(a.joinedAt).getTime()) / 60000)
    persist()
    return clone(a)
  },

  async listAttendance(classId) {
    await wait()
    const d = load()
    return clone(d.attendance.filter((a) => a.classId === classId)).map((a) => ({
      ...a, user: clone(byId(d.users, a.userId)),
    }))
  },

  /* ----------------------------------------------------- assignments */
  async listAssignments(courseId) {
    await wait()
    return sortBy(load().assignments.filter((a) => a.courseId === courseId), 'dueAt')
  },

  async getAssignment(id) {
    await wait(20)
    const a = byId(load().assignments, id)
    if (!a) throw new Error('Assignment not found.')
    return clone(a)
  },

  async createAssignment(courseId, data) {
    await wait()
    const d = load()
    const a = {
      $id: uid('a'), courseId, title: data.title, description: data.description || '',
      dueAt: data.dueAt || null, maxScore: Number(data.maxScore) || 10,
      isPublished: data.isPublished ?? true, createdAt: new Date().toISOString(),
    }
    d.assignments.push(a)
    persist()
    return clone(a)
  },

  async updateAssignment(id, patch) {
    await wait()
    const a = byId(load().assignments, id)
    if (!a) throw new Error('Assignment not found.')
    Object.assign(a, patch)
    persist()
    return clone(a)
  },

  async deleteAssignment(id) {
    await wait()
    const d = load()
    d.assignments = d.assignments.filter((a) => a.$id !== id)
    d.submissions = d.submissions.filter((s) => s.assignmentId !== id)
    persist()
    return true
  },

  async submitAssignment(assignmentId, { body, fileName }) {
    await wait()
    const d = load()
    const user = me()
    if (!user) throw new Error('Please sign in first.')
    let s = d.submissions.find((x) => x.assignmentId === assignmentId && x.userId === user.$id)
    if (s && s.status === 'returned') throw new Error('This submission has already been graded and returned.')
    if (!s) {
      s = { $id: uid('s'), assignmentId, userId: user.$id, status: 'submitted', score: null, feedback: null, gradedAt: null, gradedBy: null }
      d.submissions.push(s)
    }
    s.body = body || ''
    s.fileName = fileName || null
    s.submittedAt = new Date().toISOString()
    persist()
    return clone(s)
  },

  async mySubmission(assignmentId) {
    const user = me()
    if (!user) return null
    const s = load().submissions.find((x) => x.assignmentId === assignmentId && x.userId === user.$id)
    return s ? clone(s) : null
  },

  async listSubmissions(assignmentId) {
    await wait()
    const d = load()
    return clone(d.submissions.filter((s) => s.assignmentId === assignmentId)).map((s) => ({
      ...s, user: clone(byId(d.users, s.userId)),
    }))
  },

  async gradeSubmission(id, { score, feedback, returned }) {
    await wait()
    const d = load()
    const s = byId(d.submissions, id)
    if (!s) throw new Error('Submission not found.')
    s.score = score === '' || score === null ? null : Number(score)
    s.feedback = feedback || ''
    s.gradedAt = new Date().toISOString()
    s.gradedBy = me()?.$id
    s.status = returned ? 'returned' : 'graded'
    persist()
    return clone(s)
  },

  /* -------------------------------------------------------- questions */
  async listQuestions(courseId) {
    await wait()
    return sortBy(load().questions.filter((q) => q.courseId === courseId), 'body')
  },

  async createQuestion(courseId, data) {
    await wait()
    const d = load()
    const q = {
      $id: uid('q'), courseId, type: data.type, body: data.body,
      options: data.options || [], correctAnswer: data.correctAnswer || '',
      marks: Number(data.marks) || 1, explanation: data.explanation || '',
    }
    d.questions.push(q)
    persist()
    return clone(q)
  },

  async updateQuestion(id, patch) {
    await wait()
    const q = byId(load().questions, id)
    if (!q) throw new Error('Question not found.')
    Object.assign(q, patch)
    persist()
    return clone(q)
  },

  async deleteQuestion(id) {
    await wait()
    const d = load()
    d.questions = d.questions.filter((q) => q.$id !== id)
    d.assessmentQuestions = d.assessmentQuestions.filter((aq) => aq.questionId !== id)
    persist()
    return true
  },

  /* ------------------------------------------------------ assessments */
  async listAssessments(courseId) {
    await wait()
    const d = load()
    const rows = d.assessments.filter((a) => a.courseId === courseId)
    const user = me()
    const withExtra = rows.map((a) => {
      const aq = d.assessmentQuestions.filter((x) => x.assessmentId === a.$id)
      const attempts = d.attempts.filter((t) => t.assessmentId === a.$id && (!user || t.userId === user.$id))
      const best = attempts.filter((t) => t.status === 'graded').reduce((m, t) => Math.max(m, t.percentage || 0), 0)
      return {
        ...clone(a),
        questionCount: aq.length,
        myAttempts: attempts.length,
        myBest: best,
        isOpen: isAssessmentOpen(a),
      }
    })
    return sortBy(withExtra, 'title')
  },

  async getAssessment(id) {
    await wait(20)
    const d = load()
    const a = byId(d.assessments, id)
    if (!a) throw new Error('Assessment not found.')
    const links = sortBy(d.assessmentQuestions.filter((x) => x.assessmentId === id), 'position')
    const questions = links.map((l) => {
      const q = byId(d.questions, l.questionId)
      return q ? { ...clone(q), marks: l.marks } : null
    }).filter(Boolean)
    return { ...clone(a), questions }
  },

  async createAssessment(courseId, data) {
    await wait()
    const d = load()
    const a = {
      $id: uid('as'), courseId, title: data.title, type: data.type || 'test',
      instructions: data.instructions || '', startsAt: data.startsAt || null,
      endsAt: data.endsAt || null, durationMinutes: Number(data.durationMinutes) || 30,
      maxAttempts: Number(data.maxAttempts) || 1, passMark: Number(data.passMark) || 50,
      shuffleQuestions: !!data.shuffleQuestions, showResults: data.showResults ?? true,
      isPublished: data.isPublished ?? false, totalMarks: 0,
      createdAt: new Date().toISOString(),
    }
    d.assessments.push(a)
    persist()
    return clone(a)
  },

  async updateAssessment(id, patch) {
    await wait()
    const a = byId(load().assessments, id)
    if (!a) throw new Error('Assessment not found.')
    Object.assign(a, patch)
    persist()
    return clone(a)
  },

  async deleteAssessment(id) {
    await wait()
    const d = load()
    d.assessments = d.assessments.filter((a) => a.$id !== id)
    d.assessmentQuestions = d.assessmentQuestions.filter((x) => x.assessmentId !== id)
    d.attempts = d.attempts.filter((t) => t.assessmentId !== id)
    persist()
    return true
  },

  async setAssessmentQuestions(assessmentId, items) {
    await wait()
    const d = load()
    d.assessmentQuestions = d.assessmentQuestions.filter((x) => x.assessmentId !== assessmentId)
    let position = 1
    for (const it of items) {
      d.assessmentQuestions.push({
        $id: uid('aq'), assessmentId, questionId: it.questionId,
        position: position++, marks: Number(it.marks) || 1,
      })
    }
    const total = d.assessmentQuestions.filter((x) => x.assessmentId === assessmentId)
      .reduce((sum, x) => sum + x.marks, 0)
    const a = byId(d.assessments, assessmentId)
    if (a) a.totalMarks = total
    persist()
    return total
  },

  async startAttempt(assessmentId) {
    await wait()
    const d = load()
    const user = me()
    if (!user) throw new Error('Please sign in first.')
    const a = byId(d.assessments, assessmentId)
    if (!a) throw new Error('Assessment not found.')
    const used = d.attempts.filter((t) => t.assessmentId === assessmentId && t.userId === user.$id)
    if (used.length >= (a.maxAttempts || 1)) throw new Error('You have used all of your attempts for this assessment.')
    const attempt = {
      $id: uid('at'), assessmentId, userId: user.$id,
      startedAt: new Date().toISOString(), submittedAt: null,
      status: 'in_progress', score: 0, total: a.totalMarks || 0, percentage: 0, passed: false,
      answers: {},
    }
    d.attempts.push(attempt)
    persist()
    return clone(attempt)
  },

  async getAttempt(id) {
    await wait(20)
    const t = byId(load().attempts, id)
    if (!t) throw new Error('Attempt not found.')
    return clone(t)
  },

  async saveAnswers(attemptId, answers) {
    const d = load()
    const t = byId(d.attempts, attemptId)
    if (!t) throw new Error('Attempt not found.')
    t.answers = { ...(t.answers || {}), ...answers }
    persist()
    return clone(t)
  },

  async submitAttempt(attemptId, answers) {
    await wait()
    const d = load()
    const t = byId(d.attempts, attemptId)
    if (!t) throw new Error('Attempt not found.')
    if (answers) t.answers = { ...(t.answers || {}), ...answers }
    const a = byId(d.assessments, t.assessmentId)
    const links = sortBy(d.assessmentQuestions.filter((x) => x.assessmentId === t.assessmentId), 'position')

    let score = 0
    let total = 0
    const graded = {}
    for (const l of links) {
      const q = byId(d.questions, l.questionId)
      if (!q) continue
      total += l.marks
      const given = (t.answers || {})[q.$id]
      const answer = given?.answer ?? ''
      if (q.type === 'short_answer') {
        graded[q.$id] = { answer, marks: 0, correct: false, needsReview: true }
      } else {
        const ok = String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
        graded[q.$id] = { answer, marks: ok ? l.marks : 0, correct: ok, needsReview: false }
        if (ok) score += l.marks
      }
    }
    t.answers = graded
    t.score = score
    t.total = total
    t.percentage = total ? Math.round((score / total) * 10000) / 100 : 0
    t.passed = t.percentage >= (a?.passMark || 50)
    t.submittedAt = new Date().toISOString()
    t.status = Object.values(graded).some((g) => g.needsReview) ? 'needs_marking' : 'graded'
    persist()
    return clone(t)
  },

  async listAttempts(assessmentId) {
    await wait()
    const d = load()
    return clone(d.attempts.filter((t) => t.assessmentId === assessmentId)).map((t) => ({
      ...t, user: clone(byId(d.users, t.userId)),
    }))
  },

  async markAnswer(attemptId, questionId, marks) {
    await wait()
    const d = load()
    const t = byId(d.attempts, attemptId)
    if (!t) throw new Error('Attempt not found.')
    const entry = (t.answers || {})[questionId]
    if (!entry) throw new Error('Answer not found.')
    entry.marks = Number(marks) || 0
    entry.needsReview = false
    entry.correct = entry.marks > 0
    let score = 0
    let total = 0
    const links = d.assessmentQuestions.filter((x) => x.assessmentId === t.assessmentId)
    for (const l of links) {
      total += l.marks
      const a = (t.answers || {})[l.questionId]
      if (a) score += Number(a.marks) || 0
    }
    const a = byId(d.assessments, t.assessmentId)
    t.score = score
    t.total = total
    t.percentage = total ? Math.round((score / total) * 10000) / 100 : 0
    t.passed = t.percentage >= (a?.passMark || 50)
    t.status = Object.values(t.answers).some((x) => x.needsReview) ? 'needs_marking' : 'graded'
    persist()
    return clone(t)
  },

  /* ---------------------------------------------------- announcements */
  async listAnnouncements(courseId) {
    await wait()
    const d = load()
    return clone(d.announcements.filter((a) => a.courseId === courseId))
      .map((a) => ({ ...a, author: clone(byId(d.users, a.authorId)) }))
      .sort((x, y) => Number(y.isPinned) - Number(x.isPinned) || String(y.publishedAt).localeCompare(String(x.publishedAt)))
  },

  async createAnnouncement(courseId, data) {
    await wait()
    const d = load()
    const a = {
      $id: uid('an'), courseId, title: data.title, body: data.body || '',
      isPinned: !!data.isPinned, authorId: me()?.$id,
      publishedAt: new Date().toISOString(),
    }
    d.announcements.push(a)
    persist()
    return clone(a)
  },

  async updateAnnouncement(id, patch) {
    await wait()
    const a = byId(load().announcements, id)
    if (!a) throw new Error('Announcement not found.')
    Object.assign(a, patch)
    persist()
    return clone(a)
  },

  async deleteAnnouncement(id) {
    await wait()
    const d = load()
    d.announcements = d.announcements.filter((a) => a.$id !== id)
    persist()
    return true
  },

  /* ------------------------------------------------------- messages */
  async listMessages(courseId) {
    await wait()
    const d = load()
    return sortBy(
      clone(d.messages.filter((m) => m.courseId === courseId)).map((m) => ({
        ...m, user: clone(byId(d.users, m.userId)),
      })),
      'createdAt'
    )
  },

  async sendMessage(courseId, body) {
    await wait(30)
    const d = load()
    const user = me()
    if (!user) throw new Error('Please sign in first.')
    const m = {
      $id: uid('m'), courseId, userId: user.$id, body,
      createdAt: new Date().toISOString(),
    }
    d.messages.push(m)
    persist()
    return { ...clone(m), user: clone(user) }
  },

  /* ----------------------------------------------------- recordings */
  async listRecordings(courseId) {
    await wait()
    const d = load()
    return clone(d.recordings.filter((r) => r.courseId === courseId))
      .map((r) => ({ ...r, liveClass: r.classId ? clone(byId(d.classes, r.classId)) : null }))
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))
  },

  async createRecording(courseId, data) {
    await wait()
    const d = load()
    const r = {
      $id: uid('r'), courseId, classId: data.classId || null,
      title: data.title, description: data.description || '',
      videoUrl: data.videoUrl || '', durationMinutes: Number(data.durationMinutes) || null,
      recordedAt: data.recordedAt || new Date().toISOString(),
      isPublished: data.isPublished ?? true,
    }
    d.recordings.push(r)
    persist()
    return clone(r)
  },

  async updateRecording(id, patch) {
    await wait()
    const r = byId(load().recordings, id)
    if (!r) throw new Error('Recording not found.')
    Object.assign(r, patch)
    persist()
    return clone(r)
  },

  async deleteRecording(id) {
    await wait()
    const d = load()
    d.recordings = d.recordings.filter((r) => r.$id !== id)
    persist()
    return true
  },

  /* ------------------------------------------------------- progress */
  async getProgress(courseId) {
    await wait()
    const d = load()
    const user = me()
    if (!user) return null
    const classes = d.classes.filter((c) => c.courseId === courseId)
    const ended = classes.filter((c) => classWindow(c).hasEnded || c.status === 'ended')
    const attended = d.attendance.filter((a) => a.userId === user.$id && ended.some((c) => c.$id === a.classId))
    const assignments = d.assignments.filter((a) => a.courseId === courseId && a.isPublished)
    const submissions = d.submissions.filter((s) => s.userId === user.$id && assignments.some((a) => a.$id === s.assignmentId))
    const assessments = d.assessments.filter((a) => a.courseId === courseId && a.isPublished)
    const attempts = assessments.map((a) => {
      const mine = d.attempts.filter((t) => t.assessmentId === a.$id && t.userId === user.$id && t.status !== 'in_progress')
      const best = mine.reduce((m, t) => (t.percentage > (m?.percentage ?? -1) ? t : m), null)
      return { assessment: clone(a), attempts: mine.length, best: best ? clone(best) : null }
    })
    return {
      attendance: {
        total: ended.length,
        attended: attended.length,
        rate: ended.length ? Math.round((attended.length / ended.length) * 100) : 0,
        records: clone(attended).map((a) => ({ ...a, liveClass: clone(byId(classes, a.classId)) })),
      },
      assignments: {
        total: assignments.length,
        submitted: submissions.length,
        graded: submissions.filter((s) => s.score !== null).length,
        rows: assignments.map((a) => ({
          assignment: clone(a),
          submission: clone(submissions.find((s) => s.assignmentId === a.$id)) || null,
        })),
      },
      assessments: attempts,
    }
  },

  /* ------------------------------------------------------ utilities */
  async resetDemo() {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SESSION_KEY)
    db = null
    load()
    return true
  },
}
