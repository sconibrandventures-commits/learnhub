/**
 * Real backend — communicates with your Appwrite Cloud project.
 *
 * All operations run directly against the Appwrite Databases, Storage, and Account
 * APIs with automatic self-healing for session and permission handling.
 */
import { appwrite, Query, Permission, Role, ID } from './appwrite'
import { config, COLLECTIONS } from '../config'
import { slugify, isAssessmentOpen, classWindow } from './helpers'

const DB = () => config.databaseId
const C = COLLECTIONS
const LIMIT = 500

/* --------------------------------------------------------------- helpers */

const json = {
  parse(value, fallback) {
    if (!value) return fallback
    if (typeof value === 'object') return value
    try { return JSON.parse(value) } catch { return fallback }
  },
  stringify(value) {
    return typeof value === 'string' ? value : JSON.stringify(value ?? {})
  },
}

const optionsOf = (q) => (Array.isArray(q.options) ? q.options : json.parse(q.options, []))

async function list(db, collection, queries = []) {
  const r = await db.listDocuments(DB(), collection, [...queries, Query.limit(LIMIT)])
  return r.documents
}

async function one(db, collection, id) {
  return db.getDocument(DB(), collection, id)
}

function shapeQuestion(q, marks) {
  return {
    ...q,
    options: optionsOf(q),
    marks: marks ?? q.marks ?? 1,
  }
}

async function callFunction(functionId, payload) {
  const { functions } = appwrite()
  const execution = await functions.createExecution(functionId, JSON.stringify(payload), false)
  let body = execution.responseBody
  try { body = JSON.parse(body) } catch { /* plain text */ }
  if (execution.responseStatusCode >= 400) {
    throw new Error(body?.message || `Function "${functionId}" failed (${execution.responseStatusCode}).`)
  }
  if (body && body.ok === false) throw new Error(body.message || 'Request failed.')
  return body
}

/* ------------------------------------------------------------------ api */

export const realBackend = {
  isDemo: false,

  /* ------------------------------------------------------------ auth */
  async getSession() {
    const { account, databases } = appwrite()
    let acc
    try {
      acc = await account.get()
    } catch {
      return null // not signed in
    }

    let profile = null
    try {
      profile = await one(databases, C.profiles, acc.$id)
    } catch {
      profile = null
    }

    return {
      $id: acc.$id,
      name: profile?.name || acc.name,
      email: acc.email,
      role: profile?.role || 'student',
      isActive: profile?.isActive !== false,
      createdAt: acc.$createdAt,
    }
  },

  async login(email, password) {
    const { account, databases } = appwrite()
    const cleanEmail = String(email).trim().toLowerCase()
    await account.createEmailPasswordSession(cleanEmail, password)
    const acc = await account.get()

    // Self-heal: If profile document is missing from a failed attempt, create it now
    try {
      await one(databases, C.profiles, acc.$id)
    } catch {
      try {
        const existing = await list(databases, C.profiles, [Query.limit(1)])
        const role = existing.length === 0 ? 'admin' : 'student'
        await databases.createDocument(
          DB(), C.profiles, acc.$id,
          { userId: acc.$id, name: acc.name || 'User', email: acc.email, role, isActive: true },
          [
            Permission.read(Role.users()),
            Permission.update(Role.user(acc.$id)),
            Permission.delete(Role.user(acc.$id)),
          ]
        )
      } catch { /* ignore */ }
    }

    return this.getSession()
  },

  async logout() {
    const { account } = appwrite()
    try { await account.deleteSession('current') } catch { /* already gone */ }
  },

  async register({ name, email, password, code }) {
    const { account, databases } = appwrite()
    const cleanEmail = String(email).trim().toLowerCase()

    let acc
    try {
      acc = await account.create(ID.unique(), cleanEmail, password, name)
    } catch (err) {
      // If user already exists in Auth from a previous attempt, log in and finish profile
      if (err.message && (err.message.includes('already exists') || err.code === 409)) {
        await account.createEmailPasswordSession(cleanEmail, password)
        acc = await account.get()
      } else {
        throw err
      }
    }

    // 1. Create session FIRST so the client is authenticated
    try {
      await account.createEmailPasswordSession(cleanEmail, password)
    } catch {
      // session might already be active
    }

    // 2. The very first user to register on a clean database automatically becomes Administrator
    let role = 'student'
    try {
      const existing = await list(databases, C.profiles, [Query.limit(1)])
      if (existing.length === 0) {
        role = 'admin'
      }
    } catch {
      // fallback to student
    }

    // 3. Create profile document with the authenticated user
    try {
      await databases.createDocument(
        DB(), C.profiles, acc.$id,
        { userId: acc.$id, name, email: cleanEmail, role, isActive: true },
        [
          Permission.read(Role.users()),
          Permission.update(Role.user(acc.$id)),
          Permission.delete(Role.user(acc.$id)),
        ]
      )
    } catch (err) {
      // If document already exists, update it
      try {
        await databases.updateDocument(DB(), C.profiles, acc.$id, { name, role })
      } catch { /* ignore */ }
    }

    if (code) {
      try { await this.joinWithCode(code) } catch { /* ignore code errors on signup */ }
    }
    return this.getSession()
  },

  async updateProfile(userId, patch) {
    const { account, databases } = appwrite()
    if (patch.name) await account.updateName(patch.name)
    const data = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.email !== undefined) data.email = patch.email
    const acc = await account.get()
    await databases.updateDocument(DB(), C.profiles, acc.$id, data)
    return this.getSession()
  },

  async changePassword(userId, currentPassword, newPassword) {
    const { account } = appwrite()
    await account.updatePassword(newPassword, currentPassword)
    return true
  },

  /* ----------------------------------------------------------- users */
  async listUsers() {
    const { databases } = appwrite()
    const rows = await list(databases, C.profiles, [Query.orderAsc('name')])
    return rows.map((p) => ({
      $id: p.$id, name: p.name, email: p.email, role: p.role,
      isActive: p.isActive !== false, createdAt: p.$createdAt,
    }))
  },

  async createUser({ name, email, password, role }) {
    const cleanEmail = String(email || '').trim().toLowerCase()
    const cleanName = String(name || '').trim()
    const targetRole = role || 'student'

    if (!cleanEmail || !cleanName) throw new Error('Name and email are required.')
    if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.')

    // 1. Try Netlify serverless function first (if deployed with APPWRITE_API_KEY)
    try {
      const res = await fetch('/.netlify/functions/adminUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: cleanName, email: cleanEmail, password, role: targetRole }),
      })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.ok && body?.user) return body.user
      }
    } catch {
      // Netlify function not available; proceed to next strategy
    }

    // 2. Try Appwrite Function (if deployed)
    try {
      return await callFunction(config.functions.users, { action: 'create', name: cleanName, email: cleanEmail, password, role: targetRole })
    } catch {
      // Proceed to direct client fallback
    }

    // 3. Direct client fallback:
    // Create the Auth user via Appwrite REST API with credentials: 'omit'
    // so the admin's active session cookie in the browser is untouched.
    const baseEndpoint = (config.endpoint || 'https://cloud.appwrite.io/v1').replace(/\/+$/, '')
    const newUserId = ID.unique()

    let createdId = newUserId
    const res = await fetch(`${baseEndpoint}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': config.projectId,
      },
      credentials: 'omit',
      body: JSON.stringify({
        userId: newUserId,
        email: cleanEmail,
        password: password,
        name: cleanName,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (res.status === 409 || data?.type === 'user_already_exists' || (data?.message && data.message.includes('already exists'))) {
        throw new Error(`A user with email "${cleanEmail}" is already registered.`)
      }
      throw new Error(data?.message || `Failed to create user account (${res.status}).`)
    }

    if (data?.$id) {
      createdId = data.$id
    }

    // 4. Create the profile document in the database using the admin's database client
    const { databases } = appwrite()
    try {
      await databases.createDocument(
        DB(),
        C.profiles,
        createdId,
        {
          userId: createdId,
          name: cleanName,
          email: cleanEmail,
          role: targetRole,
          isActive: true,
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      )
    } catch (err) {
      // If profile document already exists, update it
      try {
        await databases.updateDocument(DB(), C.profiles, createdId, {
          name: cleanName,
          email: cleanEmail,
          role: targetRole,
          isActive: true,
        })
      } catch {
        throw new Error(`Account created in Auth, but profile setup failed: ${err.message}`)
      }
    }

    return {
      $id: createdId,
      name: cleanName,
      email: cleanEmail,
      role: targetRole,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
  },

  async setUserRole(userId, role) {
    // 1. Try Netlify function
    try {
      const res = await fetch('/.netlify/functions/adminUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setRole', userId, role }),
      })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.ok) return true
      }
    } catch { /* proceed */ }

    // 2. Try Appwrite function
    try {
      return await callFunction(config.functions.users, { action: 'setRole', userId, role })
    } catch {
      // 3. Direct database update
      const { databases } = appwrite()
      return databases.updateDocument(DB(), C.profiles, userId, { role })
    }
  },

  async setUserActive(userId, isActive) {
    // 1. Try Netlify function
    try {
      const res = await fetch('/.netlify/functions/adminUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActive', userId, isActive }),
      })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.ok) return true
      }
    } catch { /* proceed */ }

    // 2. Try Appwrite function
    try {
      return await callFunction(config.functions.users, { action: 'setActive', userId, isActive })
    } catch {
      // 3. Direct database update
      const { databases } = appwrite()
      return databases.updateDocument(DB(), C.profiles, userId, { isActive })
    }
  },

  async deleteUser(userId) {
    // 1. Try Netlify function
    try {
      const res = await fetch('/.netlify/functions/adminUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId }),
      })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.ok) return true
      }
    } catch { /* proceed */ }

    // 2. Try Appwrite function
    try {
      return await callFunction(config.functions.users, { action: 'delete', userId })
    } catch {
      // 3. Direct database delete
      const { databases } = appwrite()
      await databases.deleteDocument(DB(), C.profiles, userId)
      return true
    }
  },

  /* --------------------------------------------------------- courses */
  async listCourses() {
    const { databases } = appwrite()
    const rows = await list(databases, C.courses, [Query.orderAsc('title')])
    const profiles = await list(databases, C.profiles)
    return rows.map((c) => ({
      ...c,
      instructor: profiles.find((p) => p.$id === c.instructorId) || null,
    }))
  },

  async getCourse(idOrSlug) {
    const { databases } = appwrite()
    let course
    try {
      course = await one(databases, C.courses, idOrSlug)
    } catch {
      const rows = await list(databases, C.courses, [Query.equal('slug', idOrSlug), Query.limit(1)])
      course = rows[0]
    }
    if (!course) throw new Error('Course not found.')
    let instructor = null
    try { instructor = await one(databases, C.profiles, course.instructorId) } catch { /* no instructor */ }
    return { ...course, instructor }
  },

  async myCourseIds() {
    const user = await this.getSession()
    if (!user) return []
    const { databases } = appwrite()
    if (user.role === 'admin') {
      const all = await list(databases, C.courses)
      return all.map((c) => c.$id)
    }
    if (user.role === 'instructor') {
      const mine = await list(databases, C.courses, [Query.equal('instructorId', user.$id)])
      return mine.map((c) => c.$id)
    }
    const enrolments = await list(databases, C.enrolments, [
      Query.equal('userId', user.$id),
      Query.equal('status', 'active'),
    ])
    return enrolments.map((e) => e.courseId)
  },

  async createCourse(data) {
    const { databases } = appwrite()
    const user = await this.getSession()
    const slug = slugify(data.title)
    const teamId = `course_${slug}_${Math.random().toString(36).slice(2, 6)}`

    const course = await databases.createDocument(
      DB(), C.courses, ID.unique(),
      {
        title: data.title, slug, code: (data.code || '').toUpperCase(),
        description: data.description || '', instructorId: user?.$id,
        teamId, category: data.category || '', level: data.level || 'beginner',
        status: data.status || 'draft', passMark: Number(data.passMark) || 50,
        enrollmentOpen: data.enrollmentOpen ?? true,
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    )
    return course
  },

  async updateCourse(id, patch) {
    const { databases } = appwrite()
    const data = { ...patch }
    if (patch.title) data.slug = slugify(patch.title)
    if (patch.passMark !== undefined) data.passMark = Number(patch.passMark)
    return databases.updateDocument(DB(), C.courses, id, data)
  },

  async deleteCourse(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.courses, id)
    return true
  },

  /* ------------------------------------------------------ enrolments */
  async listEnrolments({ courseId, userId } = {}) {
    const { databases } = appwrite()
    const q = []
    if (courseId) q.push(Query.equal('courseId', courseId))
    if (userId) q.push(Query.equal('userId', userId))
    const rows = await list(databases, C.enrolments, q)
    const profiles = await list(databases, C.profiles)
    const courses = await list(databases, C.courses)
    return rows.map((e) => ({
      ...e,
      user: profiles.find((p) => p.$id === e.userId) || null,
      course: courses.find((c) => c.$id === e.courseId) || null,
    }))
  },

  async myEnrolment(courseId) {
    const user = await this.getSession()
    if (!user) return null
    const { databases } = appwrite()
    const rows = await list(databases, C.enrolments, [
      Query.equal('userId', user.$id),
      Query.equal('courseId', courseId),
      Query.limit(1),
    ])
    return rows[0] || null
  },

  async enrol({ userId, courseId, status = 'active' }) {
    try {
      return await callFunction(config.functions.enrolment, { action: 'enrol', userId, courseId, status })
    } catch {
      const { databases } = appwrite()
      const user = await this.getSession()
      const existing = await list(databases, C.enrolments, [
        Query.equal('userId', userId),
        Query.equal('courseId', courseId),
        Query.limit(1),
      ])
      const now = new Date().toISOString()
      if (existing[0]) {
        return databases.updateDocument(DB(), C.enrolments, existing[0].$id, {
          status,
          approvedAt: status === 'active' ? now : existing[0].approvedAt,
          approvedBy: status === 'active' ? user?.$id : existing[0].approvedBy,
        })
      }
      return databases.createDocument(
        DB(), C.enrolments, ID.unique(),
        {
          userId,
          courseId,
          status,
          enrolledAt: now,
          approvedAt: status === 'active' ? now : null,
          approvedBy: status === 'active' ? user?.$id : null,
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      )
    }
  },

  async setEnrolmentStatus(id, status) {
    try {
      return await callFunction(config.functions.enrolment, { action: 'setStatus', enrolmentId: id, status })
    } catch {
      const { databases } = appwrite()
      const user = await this.getSession()
      const now = new Date().toISOString()
      return databases.updateDocument(DB(), C.enrolments, id, {
        status,
        approvedAt: status === 'active' ? now : undefined,
        approvedBy: status === 'active' ? user?.$id : undefined,
      })
    }
  },

  async removeEnrolment(id) {
    try {
      return await callFunction(config.functions.enrolment, { action: 'remove', enrolmentId: id })
    } catch {
      const { databases } = appwrite()
      await databases.deleteDocument(DB(), C.enrolments, id)
      return true
    }
  },

  async joinWithCode(code) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) throw new Error('Please sign in first.')
    const rows = await list(databases, C.courses, [
      Query.equal('code', String(code).toUpperCase()),
      Query.limit(1),
    ])
    const course = rows[0]
    if (!course) throw new Error('That enrolment code is not recognised.')
    if (!course.enrollmentOpen) throw new Error('Enrolment for that course is closed.')
    return this.enrol({ userId: user.$id, courseId: course.$id, status: 'active' })
  },

  /* --------------------------------------------------------- classes */
  async listClasses(courseId) {
    const { databases } = appwrite()
    return list(databases, C.classes, [
      Query.equal('courseId', courseId),
      Query.orderAsc('startsAt'),
    ])
  },

  async getClass(id) {
    const { databases } = appwrite()
    return one(databases, C.classes, id)
  },

  async createClass(courseId, data) {
    const { databases } = appwrite()
    const user = await this.getSession()
    return databases.createDocument(DB(), C.classes, ID.unique(), {
      courseId, title: data.title, description: data.description || '',
      startsAt: data.startsAt, durationMinutes: Number(data.durationMinutes) || 60,
      status: data.status || 'scheduled',
      zoomMeetingId: data.zoomMeetingId || '', zoomPassword: data.zoomPassword || '',
      zoomJoinUrl: data.zoomJoinUrl || '', zoomStartUrl: data.zoomStartUrl || '',
      createdBy: user?.$id,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
  },

  async updateClass(id, patch) {
    const { databases } = appwrite()
    return databases.updateDocument(DB(), C.classes, id, patch)
  },

  async deleteClass(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.classes, id)
    return true
  },

  async joinClass(classId) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) throw new Error('Please sign in first.')
    const existing = await list(databases, C.attendance, [
      Query.equal('classId', classId),
      Query.equal('userId', user.$id),
      Query.limit(1),
    ])
    const now = new Date().toISOString()
    if (existing[0]) {
      return databases.updateDocument(DB(), C.attendance, existing[0].$id, {
        lastPingAt: now,
        minutesPresent: Math.round((Date.now() - new Date(existing[0].joinedAt).getTime()) / 60000),
      })
    }
    return databases.createDocument(DB(), C.attendance, ID.unique(), {
      classId, userId: user.$id, joinedAt: now, lastPingAt: now, minutesPresent: 0,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ])
  },

  async heartbeat(classId) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) return null
    const rows = await list(databases, C.attendance, [
      Query.equal('classId', classId), Query.equal('userId', user.$id), Query.limit(1),
    ])
    if (!rows[0]) return null
    return databases.updateDocument(DB(), C.attendance, rows[0].$id, {
      lastPingAt: new Date().toISOString(),
      minutesPresent: Math.round((Date.now() - new Date(rows[0].joinedAt).getTime()) / 60000),
    })
  },

  async listAttendance(classId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.attendance, [Query.equal('classId', classId)])
    const profiles = await list(databases, C.profiles)
    return rows.map((a) => ({ ...a, user: profiles.find((p) => p.$id === a.userId) || null }))
  },

  /* ----------------------------------------------------- assignments */
  async listAssignments(courseId) {
    const { databases } = appwrite()
    return list(databases, C.assignments, [
      Query.equal('courseId', courseId), Query.orderAsc('dueAt'),
    ])
  },

  async getAssignment(id) {
    const { databases } = appwrite()
    return one(databases, C.assignments, id)
  },

  async createAssignment(courseId, data) {
    const { databases } = appwrite()
    return databases.createDocument(DB(), C.assignments, ID.unique(), {
      courseId, title: data.title, description: data.description || '',
      dueAt: data.dueAt || null, maxScore: Number(data.maxScore) || 10,
      isPublished: data.isPublished ?? true,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
  },

  async updateAssignment(id, patch) {
    const { databases } = appwrite()
    return databases.updateDocument(DB(), C.assignments, id, patch)
  },

  async deleteAssignment(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.assignments, id)
    return true
  },

  async submitAssignment(assignmentId, { body, fileName }) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) throw new Error('Please sign in first.')
    const existing = await list(databases, C.submissions, [
      Query.equal('assignmentId', assignmentId), Query.equal('userId', user.$id), Query.limit(1),
    ])
    const data = { body: body || '', fileName: fileName || null, submittedAt: new Date().toISOString() }
    const perms = [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ]
    if (existing[0]) {
      if (existing[0].status === 'returned') throw new Error('This submission has already been graded and returned.')
      return databases.updateDocument(DB(), C.submissions, existing[0].$id, data)
    }
    return databases.createDocument(DB(), C.submissions, ID.unique(), {
      assignmentId, userId: user.$id, status: 'submitted',
      score: null, feedback: null, gradedAt: null, gradedBy: null, ...data,
    }, perms)
  },

  async mySubmission(assignmentId) {
    const user = await this.getSession()
    if (!user) return null
    const { databases } = appwrite()
    const rows = await list(databases, C.submissions, [
      Query.equal('assignmentId', assignmentId), Query.equal('userId', user.$id), Query.limit(1),
    ])
    return rows[0] || null
  },

  async listSubmissions(assignmentId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.submissions, [Query.equal('assignmentId', assignmentId)])
    const profiles = await list(databases, C.profiles)
    return rows.map((s) => ({ ...s, user: profiles.find((p) => p.$id === s.userId) || null }))
  },

  async gradeSubmission(id, { score, feedback, returned }) {
    const { databases } = appwrite()
    const user = await this.getSession()
    return databases.updateDocument(DB(), C.submissions, id, {
      score: score === '' || score === null ? null : Number(score),
      feedback: feedback || '',
      gradedAt: new Date().toISOString(),
      gradedBy: user?.$id,
      status: returned ? 'returned' : 'graded',
    })
  },

  /* -------------------------------------------------------- questions */
  async listQuestions(courseId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.questions, [Query.equal('courseId', courseId)])
    return rows.map((q) => shapeQuestion(q))
  },

  async createQuestion(courseId, data) {
    const { databases } = appwrite()
    const doc = await databases.createDocument(DB(), C.questions, ID.unique(), {
      courseId, type: data.type, body: data.body,
      options: data.options || [],
      correctAnswer: data.correctAnswer || '',
      marks: Number(data.marks) || 1, explanation: data.explanation || '',
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
    return shapeQuestion(doc)
  },

  async updateQuestion(id, patch) {
    const { databases } = appwrite()
    const data = { ...patch }
    if (data.options) data.options = Array.isArray(data.options) ? data.options : json.parse(data.options, [])
    if (data.marks !== undefined) data.marks = Number(data.marks)
    const doc = await databases.updateDocument(DB(), C.questions, id, data)
    return shapeQuestion(doc)
  },

  async deleteQuestion(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.questions, id)
    return true
  },

  /* ------------------------------------------------------ assessments */
  async listAssessments(courseId) {
    const { databases } = appwrite()
    const user = await this.getSession()
    const rows = await list(databases, C.assessments, [Query.equal('courseId', courseId)])
    const links = await list(databases, C.assessmentQuestions, [Query.equal('courseId', courseId)])
    let attempts = []
    if (user) {
      attempts = await list(databases, C.attempts, [
        Query.equal('courseId', courseId), Query.equal('userId', user.$id),
      ])
    }
    return rows.map((a) => {
      const mine = attempts.filter((t) => t.assessmentId === a.$id)
      const best = mine.reduce((m, t) => Math.max(m, t.percentage || 0), 0)
      return {
        ...a,
        questionCount: links.filter((l) => l.assessmentId === a.$id).length,
        myAttempts: mine.length,
        myBest: best,
        isOpen: isAssessmentOpen(a),
      }
    })
  },

  async getAssessment(id) {
    const { databases } = appwrite()
    const a = await one(databases, C.assessments, id)
    const links = await list(databases, C.assessmentQuestions, [Query.equal('assessmentId', id)])
    links.sort((x, y) => (x.position || 0) - (y.position || 0))
    const questions = []
    for (const l of links) {
      try {
        const q = await one(databases, C.questions, l.questionId)
        questions.push(shapeQuestion(q, l.marks))
      } catch { /* question deleted */ }
    }
    return { ...a, questions }
  },

  async createAssessment(courseId, data) {
    const { databases } = appwrite()
    return databases.createDocument(DB(), C.assessments, ID.unique(), {
      courseId, title: data.title, type: data.type || 'test',
      instructions: data.instructions || '',
      startsAt: data.startsAt || null, endsAt: data.endsAt || null,
      durationMinutes: Number(data.durationMinutes) || 30,
      maxAttempts: Number(data.maxAttempts) || 1,
      passMark: Number(data.passMark) || 50,
      shuffleQuestions: !!data.shuffleQuestions,
      showResults: data.showResults ?? true,
      isPublished: data.isPublished ?? false,
      totalMarks: 0,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
  },

  async updateAssessment(id, patch) {
    const { databases } = appwrite()
    const data = { ...patch }
    for (const k of ['durationMinutes', 'maxAttempts', 'passMark']) {
      if (data[k] !== undefined) data[k] = Number(data[k])
    }
    return databases.updateDocument(DB(), C.assessments, id, data)
  },

  async deleteAssessment(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.assessments, id)
    return true
  },

  async setAssessmentQuestions(assessmentId, items) {
    const { databases } = appwrite()
    const assessment = await one(databases, C.assessments, assessmentId)
    const old = await list(databases, C.assessmentQuestions, [Query.equal('assessmentId', assessmentId)])
    for (const o of old) {
      try { await databases.deleteDocument(DB(), C.assessmentQuestions, o.$id) } catch { /* ignore */ }
    }
    let position = 1
    let total = 0
    for (const it of items) {
      const marks = Number(it.marks) || 1
      total += marks
      await databases.createDocument(DB(), C.assessmentQuestions, ID.unique(), {
        assessmentId, questionId: it.questionId, courseId: assessment.courseId,
        position: position++, marks,
      }, [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ])
    }
    await databases.updateDocument(DB(), C.assessments, assessmentId, { totalMarks: total })
    return total
  },

  async startAttempt(assessmentId) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) throw new Error('Please sign in first.')
    const a = await one(databases, C.assessments, assessmentId)
    const used = await list(databases, C.attempts, [
      Query.equal('assessmentId', assessmentId), Query.equal('userId', user.$id),
    ])
    if (used.length >= (a.maxAttempts || 1)) throw new Error('You have used all of your attempts for this assessment.')
    return databases.createDocument(DB(), C.attempts, ID.unique(), {
      assessmentId, courseId: a.courseId, userId: user.$id,
      startedAt: new Date().toISOString(), submittedAt: null,
      status: 'in_progress', score: 0, total: a.totalMarks || 0,
      percentage: 0, passed: false, answers: '{}',
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ])
  },

  async getAttempt(id) {
    const { databases } = appwrite()
    const t = await one(databases, C.attempts, id)
    return { ...t, answers: json.parse(t.answers, {}) }
  },

  async saveAnswers(attemptId, answers) {
    const { databases } = appwrite()
    const t = await one(databases, C.attempts, attemptId)
    const merged = { ...json.parse(t.answers, {}), ...answers }
    const doc = await databases.updateDocument(DB(), C.attempts, attemptId, { answers: json.stringify(merged) })
    return { ...doc, answers: merged }
  },

  async submitAttempt(attemptId, answers) {
    try {
      return await callFunction(config.functions.grading, { action: 'submit', attemptId, answers })
    } catch {
      const { databases } = appwrite()
      const t = await one(databases, C.attempts, attemptId)
      const currentAnswers = { ...json.parse(t.answers, {}), ...(answers || {}) }
      const a = await one(databases, C.assessments, t.assessmentId)
      const links = await list(databases, C.assessmentQuestions, [Query.equal('assessmentId', t.assessmentId)])
      links.sort((x, y) => (x.position || 0) - (y.position || 0))

      let score = 0
      let total = 0
      const graded = {}
      for (const l of links) {
        const q = await one(databases, C.questions, l.questionId)
        if (!q) continue
        total += l.marks
        const given = currentAnswers[q.$id]
        const answer = typeof given === 'object' ? given.answer : (given ?? '')
        if (q.type === 'short_answer') {
          graded[q.$id] = { answer, marks: 0, correct: false, needsReview: true }
        } else {
          const ok = String(answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
          graded[q.$id] = { answer, marks: ok ? l.marks : 0, correct: ok, needsReview: false }
          if (ok) score += l.marks
        }
      }
      const percentage = total ? Math.round((score / total) * 10000) / 100 : 0
      const passed = percentage >= (a?.passMark || 50)
      const status = Object.values(graded).some((g) => g.needsReview) ? 'needs_marking' : 'graded'
      const doc = await databases.updateDocument(DB(), C.attempts, attemptId, {
        answers: json.stringify(graded),
        score,
        total,
        percentage,
        passed,
        submittedAt: new Date().toISOString(),
        status,
      })
      return { ...doc, answers: graded }
    }
  },

  async listAttempts(assessmentId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.attempts, [Query.equal('assessmentId', assessmentId)])
    const profiles = await list(databases, C.profiles)
    return rows.map((t) => ({ ...t, user: profiles.find((p) => p.$id === t.userId) || null }))
  },

  async markAnswer(attemptId, questionId, marks) {
    try {
      return await callFunction(config.functions.grading, { action: 'mark', attemptId, questionId, marks: Number(marks) })
    } catch {
      const { databases } = appwrite()
      const t = await one(databases, C.attempts, attemptId)
      const answers = json.parse(t.answers, {})
      const entry = answers[questionId]
      if (entry) {
        entry.marks = Number(marks) || 0
        entry.needsReview = false
        entry.correct = entry.marks > 0
      }
      const links = await list(databases, C.assessmentQuestions, [Query.equal('assessmentId', t.assessmentId)])
      let score = 0
      let total = 0
      for (const l of links) {
        total += l.marks
        const a = answers[l.questionId]
        if (a) score += Number(a.marks) || 0
      }
      const a = await one(databases, C.assessments, t.assessmentId)
      const percentage = total ? Math.round((score / total) * 10000) / 100 : 0
      const passed = percentage >= (a?.passMark || 50)
      const status = Object.values(answers).some((x) => x.needsReview) ? 'needs_marking' : 'graded'
      const doc = await databases.updateDocument(DB(), C.attempts, attemptId, {
        answers: json.stringify(answers),
        score,
        total,
        percentage,
        passed,
        status,
      })
      return { ...doc, answers }
    }
  },

  /* ---------------------------------------------------- announcements */
  async listAnnouncements(courseId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.announcements, [Query.equal('courseId', courseId)])
    const profiles = await list(databases, C.profiles)
    return rows
      .map((a) => ({ ...a, author: profiles.find((p) => p.$id === a.authorId) || null }))
      .sort((x, y) => Number(y.isPinned) - Number(x.isPinned) || String(y.publishedAt).localeCompare(String(y.publishedAt)))
  },

  async createAnnouncement(courseId, data) {
    const { databases } = appwrite()
    const user = await this.getSession()
    return databases.createDocument(DB(), C.announcements, ID.unique(), {
      courseId, title: data.title, body: data.body || '',
      isPinned: !!data.isPinned, authorId: user?.$id,
      publishedAt: new Date().toISOString(),
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
  },

  async updateAnnouncement(id, patch) {
    const { databases } = appwrite()
    return databases.updateDocument(DB(), C.announcements, id, patch)
  },

  async deleteAnnouncement(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.announcements, id)
    return true
  },

  /* -------------------------------------------------------- messages */
  async listMessages(courseId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.messages, [
      Query.equal('courseId', courseId), Query.orderAsc('$createdAt'), Query.limit(300),
    ])
    const profiles = await list(databases, C.profiles)
    return rows.map((m) => ({ ...m, user: profiles.find((p) => p.$id === m.userId) || null }))
  },

  async sendMessage(courseId, body) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) throw new Error('Please sign in first.')
    const doc = await databases.createDocument(DB(), C.messages, ID.unique(), {
      courseId, userId: user.$id, body,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id)),
    ])
    return { ...doc, user }
  },

  /* ------------------------------------------------------ recordings */
  async listRecordings(courseId) {
    const { databases } = appwrite()
    const rows = await list(databases, C.recordings, [Query.equal('courseId', courseId)])
    const classes = await list(databases, C.classes, [Query.equal('courseId', courseId)])
    return rows
      .map((r) => ({ ...r, liveClass: classes.find((c) => c.$id === r.classId) || null }))
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))
  },

  async createRecording(courseId, data) {
    const { databases } = appwrite()
    return databases.createDocument(DB(), C.recordings, ID.unique(), {
      courseId, classId: data.classId || null, title: data.title,
      description: data.description || '', videoUrl: data.videoUrl || '',
      durationMinutes: Number(data.durationMinutes) || null,
      recordedAt: data.recordedAt || new Date().toISOString(),
      isPublished: data.isPublished ?? true,
    }, [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ])
  },

  async updateRecording(id, patch) {
    const { databases } = appwrite()
    return databases.updateDocument(DB(), C.recordings, id, patch)
  },

  async deleteRecording(id) {
    const { databases } = appwrite()
    await databases.deleteDocument(DB(), C.recordings, id)
    return true
  },

  /* ------------------------------------------------------- progress */
  async getProgress(courseId) {
    const { databases } = appwrite()
    const user = await this.getSession()
    if (!user) return null
    const [classes, attendance, assignments, submissions, assessments] = await Promise.all([
      list(databases, C.classes, [Query.equal('courseId', courseId)]),
      list(databases, C.attendance, [Query.equal('courseId', courseId), Query.equal('userId', user.$id)]),
      list(databases, C.assignments, [Query.equal('courseId', courseId)]),
      list(databases, C.submissions, [Query.equal('courseId', courseId), Query.equal('userId', user.$id)]),
      list(databases, C.assessments, [Query.equal('courseId', courseId)]),
    ])
    const ended = classes.filter((c) => classWindow(c).hasEnded || c.status === 'ended')
    const attended = attendance.filter((a) => ended.some((c) => c.$id === a.classId))
    const published = assignments.filter((a) => a.isPublished)
    return {
      attendance: {
        total: ended.length,
        attended: attended.length,
        rate: ended.length ? Math.round((attended.length / ended.length) * 100) : 0,
        records: attended.map((a) => ({ ...a, liveClass: classes.find((c) => c.$id === a.classId) || null })),
      },
      assignments: {
        total: published.length,
        submitted: submissions.length,
        graded: submissions.filter((s) => s.score !== null).length,
        rows: published.map((a) => ({
          assignment: a,
          submission: submissions.find((s) => s.assignmentId === a.$id) || null,
        })),
      },
      assessments: await Promise.all(
        assessments.map(async (a) => {
          const mine = await list(databases, C.attempts, [
            Query.equal('assessmentId', a.$id), Query.equal('userId', user.$id),
          ])
          const done = mine.filter((t) => t.status !== 'in_progress')
          const best = done.reduce((m, t) => (t.percentage > (m?.percentage ?? -1) ? t : m), null)
          return { assessment: a, attempts: done.length, best }
        })
      ),
    }
  },

  async resetDemo() {
    throw new Error('The demo can only be reset while running in demo mode.')
  },
}
