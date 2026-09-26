/**
 * Central configuration.
 *
 * The app runs in one of two modes:
 *   demo  – everything lives in the browser (localStorage). No backend needed.
 *   live  – everything goes to your Appwrite Cloud project.
 *
 * We fall back to demo mode whenever Appwrite isn't configured, so the app
 * never shows a blank screen just because someone forgot a .env file.
 */

const raw = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || '',
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || '',
  demoFlag: import.meta.env.VITE_DEMO_MODE,
  appName: import.meta.env.VITE_APP_NAME || 'LearnHub',
}

const demoRequested = String(raw.demoFlag).toLowerCase() !== 'false'
const appwriteConfigured = Boolean(raw.endpoint && raw.projectId)

// Demo mode is on if it was explicitly requested, or if Appwrite is missing.
export const DEMO_MODE = demoRequested || !appwriteConfigured

// True when the user asked for live mode but hasn't finished configuring it.
export const NEEDS_SETUP = !demoRequested && !appwriteConfigured

export const config = {
  endpoint: raw.endpoint || 'https://cloud.appwrite.io/v1',
  projectId: raw.projectId,
  appName: raw.appName,
  demo: DEMO_MODE,

  // Appwrite resource IDs. Keep these in step with setup/provision.mjs
  databaseId: 'learnhub',
  buckets: {
    attachments: 'attachments',
    avatars: 'avatars',
  },
  functions: {
    enrolment: 'enrolment',
    grading: 'grading',
    users: 'users',
  },
}

export const COLLECTIONS = {
  profiles: 'profiles',
  courses: 'courses',
  enrolments: 'enrolments',
  classes: 'classes',
  attendance: 'attendance',
  assignments: 'assignments',
  submissions: 'submissions',
  questions: 'questions',
  assessments: 'assessments',
  assessmentQuestions: 'assessment_questions',
  attempts: 'attempts',
  announcements: 'announcements',
  messages: 'messages',
  recordings: 'recordings',
}

export const ROLES = {
  admin: 'admin',
  instructor: 'instructor',
  student: 'student',
}

export const ENROLMENT_STATUS = {
  pending: 'pending',
  active: 'active',
  suspended: 'suspended',
  completed: 'completed',
}
