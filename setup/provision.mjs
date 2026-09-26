#!/usr/bin/env node
/**
 * LearnHub — Appwrite automated provisioner.
 *
 * Connects to your Appwrite Cloud project and creates the database,
 * all collections, attributes, indexes, and storage buckets.
 *
 * Usage:
 *   1. Create an API key in your Appwrite Cloud console:
 *        Appwrite Console -> Settings -> View API Keys -> Create API Key
 *        Scopes needed: databases.write, collections.write, attributes.write,
 *                       buckets.write, teams.write, users.write
 *   2. Set APPWRITE_API_KEY in your .env file
 *   3. Run: npm run setup:appwrite
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as sdk from 'node-appwrite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Load .env if present
const envPath = path.join(ROOT, '.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      val = val.replace(/^["']|["']$/g, '') // strip quotes
      if (!process.env[key]) process.env[key] = val
    }
  }
}

function normalizeEndpoint(raw) {
  if (!raw) return 'https://cloud.appwrite.io/v1'
  let u = String(raw).trim().replace(/^["']|["']$/g, '')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  u = u.replace(/\/+$/, '')
  if (!u.endsWith('/v1')) u += '/v1'
  return u
}

const ENDPOINT = normalizeEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
const PROJECT_ID = (process.env.VITE_APPWRITE_PROJECT_ID || '').trim().replace(/^["']|["']$/g, '')
const API_KEY = (process.env.APPWRITE_API_KEY || '').trim().replace(/^["']|["']$/g, '')
const DB_ID = 'learnhub'

console.log('------------------------------------------------------------')
console.log('  LearnHub — Appwrite Provisioner')
console.log('------------------------------------------------------------')
console.log(`• Target Endpoint:   ${ENDPOINT}`)
console.log(`• Target Project ID: ${PROJECT_ID || '(missing)'}`)
console.log('------------------------------------------------------------')

if (!PROJECT_ID) {
  console.error('\n❌ Missing VITE_APPWRITE_PROJECT_ID in .env')
  console.error('   Please add your Appwrite Project ID to .env and retry.\n')
  process.exit(1)
}

if (!API_KEY) {
  console.error('\n❌ Missing APPWRITE_API_KEY in .env')
  console.error('   To provision collections automatically, an API key is required.')
  console.error('   Create one in Appwrite Console -> Project Settings -> API Keys.')
  console.error('   Required scopes: databases.write, collections.write,')
  console.error('                    attributes.write, buckets.write, teams.write\n')
  process.exit(1)
}

const client = new sdk.Client()
client.setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY)

const db = new sdk.Databases(client)
const storage = new sdk.Storage(client)

const wait = (ms = 1200) => new Promise((r) => setTimeout(r, ms))

async function ensureDatabase() {
  process.stdout.write(`• Checking database "${DB_ID}"... `)
  try {
    await db.get(DB_ID)
    console.log('exists.')
  } catch {
    await db.create(DB_ID, 'LearnHub')
    console.log('created.')
  }
}

const COLLECTIONS = [
  {
    id: 'profiles',
    name: 'User Profiles',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 128, required: true },
      { key: 'email', type: 'string', size: 255, required: true },
      { key: 'role', type: 'enum', elements: ['admin', 'instructor', 'student'], required: true },
      { key: 'isActive', type: 'boolean', required: false, default: true },
    ],
  },
  {
    id: 'courses',
    name: 'Courses',
    attributes: [
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'slug', type: 'string', size: 255, required: true },
      { key: 'code', type: 'string', size: 32, required: false },
      { key: 'description', type: 'string', size: 2000, required: false },
      { key: 'instructorId', type: 'string', size: 64, required: false },
      { key: 'teamId', type: 'string', size: 64, required: false },
      { key: 'category', type: 'string', size: 128, required: false },
      { key: 'level', type: 'enum', elements: ['beginner', 'intermediate', 'advanced'], required: false, default: 'beginner' },
      { key: 'status', type: 'enum', elements: ['draft', 'published', 'archived'], required: false, default: 'draft' },
      { key: 'passMark', type: 'integer', required: false, default: 50 },
      { key: 'enrollmentOpen', type: 'boolean', required: false, default: true },
    ],
  },
  {
    id: 'enrolments',
    name: 'Course Enrolments',
    attributes: [
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'status', type: 'enum', elements: ['pending', 'active', 'suspended', 'completed'], required: true },
      { key: 'enrolledAt', type: 'datetime', required: false },
      { key: 'approvedAt', type: 'datetime', required: false },
      { key: 'approvedBy', type: 'string', size: 64, required: false },
    ],
  },
  {
    id: 'classes',
    name: 'Live Classes',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'description', type: 'string', size: 2000, required: false },
      { key: 'startsAt', type: 'datetime', required: true },
      { key: 'durationMinutes', type: 'integer', required: false, default: 60 },
      { key: 'status', type: 'enum', elements: ['scheduled', 'live', 'ended', 'cancelled'], required: false, default: 'scheduled' },
      { key: 'zoomMeetingId', type: 'string', size: 64, required: false },
      { key: 'zoomPassword', type: 'string', size: 64, required: false },
      { key: 'zoomJoinUrl', type: 'string', size: 1000, required: false },
      { key: 'zoomStartUrl', type: 'string', size: 1000, required: false },
      { key: 'createdBy', type: 'string', size: 64, required: false },
    ],
  },
  {
    id: 'attendance',
    name: 'Class Attendance',
    attributes: [
      { key: 'classId', type: 'string', size: 64, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'joinedAt', type: 'datetime', required: true },
      { key: 'lastPingAt', type: 'datetime', required: false },
      { key: 'minutesPresent', type: 'integer', required: false, default: 0 },
    ],
  },
  {
    id: 'assignments',
    name: 'Assignments',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'description', type: 'string', size: 3000, required: false },
      { key: 'dueAt', type: 'datetime', required: false },
      { key: 'maxScore', type: 'integer', required: false, default: 20 },
      { key: 'isPublished', type: 'boolean', required: false, default: true },
    ],
  },
  {
    id: 'submissions',
    name: 'Submissions',
    attributes: [
      { key: 'assignmentId', type: 'string', size: 64, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'body', type: 'string', size: 5000, required: false },
      { key: 'fileName', type: 'string', size: 255, required: false },
      { key: 'submittedAt', type: 'datetime', required: false },
      { key: 'score', type: 'integer', required: false },
      { key: 'feedback', type: 'string', size: 2000, required: false },
      { key: 'status', type: 'enum', elements: ['submitted', 'graded', 'returned'], required: false, default: 'submitted' },
      { key: 'gradedAt', type: 'datetime', required: false },
      { key: 'gradedBy', type: 'string', size: 64, required: false },
    ],
  },
  {
    id: 'questions',
    name: 'Question Bank',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'type', type: 'enum', elements: ['mcq', 'true_false', 'short_answer'], required: true },
      { key: 'body', type: 'string', size: 2000, required: true },
      { key: 'options', type: 'string', size: 2000, required: false, array: true },
      { key: 'correctAnswer', type: 'string', size: 500, required: false },
      { key: 'marks', type: 'integer', required: false, default: 1 },
      { key: 'explanation', type: 'string', size: 2000, required: false },
    ],
  },
  {
    id: 'assessments',
    name: 'Assessments',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'type', type: 'enum', elements: ['test', 'exam'], required: true },
      { key: 'instructions', type: 'string', size: 2000, required: false },
      { key: 'startsAt', type: 'datetime', required: false },
      { key: 'endsAt', type: 'datetime', required: false },
      { key: 'durationMinutes', type: 'integer', required: false, default: 30 },
      { key: 'maxAttempts', type: 'integer', required: false, default: 1 },
      { key: 'passMark', type: 'integer', required: false, default: 50 },
      { key: 'shuffleQuestions', type: 'boolean', required: false, default: false },
      { key: 'showResults', type: 'boolean', required: false, default: true },
      { key: 'isPublished', type: 'boolean', required: false, default: false },
      { key: 'totalMarks', type: 'integer', required: false, default: 0 },
    ],
  },
  {
    id: 'assessment_questions',
    name: 'Assessment Questions',
    attributes: [
      { key: 'assessmentId', type: 'string', size: 64, required: true },
      { key: 'questionId', type: 'string', size: 64, required: true },
      { key: 'courseId', type: 'string', size: 64, required: false },
      { key: 'position', type: 'integer', required: true },
      { key: 'marks', type: 'integer', required: false, default: 1 },
    ],
  },
  {
    id: 'attempts',
    name: 'Assessment Attempts',
    attributes: [
      { key: 'assessmentId', type: 'string', size: 64, required: true },
      { key: 'courseId', type: 'string', size: 64, required: false },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'startedAt', type: 'datetime', required: true },
      { key: 'submittedAt', type: 'datetime', required: false },
      { key: 'status', type: 'enum', elements: ['in_progress', 'graded', 'needs_marking'], required: false, default: 'in_progress' },
      { key: 'score', type: 'integer', required: false, default: 0 },
      { key: 'total', type: 'integer', required: false, default: 0 },
      { key: 'percentage', type: 'float', required: false, default: 0 },
      { key: 'passed', type: 'boolean', required: false, default: false },
      { key: 'answers', type: 'string', size: 10000, required: false },
    ],
  },
  {
    id: 'announcements',
    name: 'Announcements',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'body', type: 'string', size: 3000, required: true },
      { key: 'isPinned', type: 'boolean', required: false, default: false },
      { key: 'authorId', type: 'string', size: 64, required: false },
      { key: 'publishedAt', type: 'datetime', required: true },
    ],
  },
  {
    id: 'messages',
    name: 'Class Chat Messages',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'userId', type: 'string', size: 64, required: true },
      { key: 'body', type: 'string', size: 2000, required: true },
    ],
  },
  {
    id: 'recordings',
    name: 'Recordings',
    attributes: [
      { key: 'courseId', type: 'string', size: 64, required: true },
      { key: 'classId', type: 'string', size: 64, required: false },
      { key: 'title', type: 'string', size: 255, required: true },
      { key: 'description', type: 'string', size: 2000, required: false },
      { key: 'videoUrl', type: 'string', size: 1000, required: false },
      { key: 'durationMinutes', type: 'integer', required: false },
      { key: 'recordedAt', type: 'datetime', required: false },
      { key: 'isPublished', type: 'boolean', required: false, default: true },
    ],
  },
]

async function ensureCollection(col) {
  process.stdout.write(`• Collection "${col.id}"... `)
  let existing = null
  try {
    existing = await db.getCollection(DB_ID, col.id)
    console.log('exists.')
  } catch {
    // Enable document security so per-document team permissions work!
    await db.createCollection(DB_ID, col.id, col.name, [
      sdk.Permission.read(sdk.Role.users()),
      sdk.Permission.create(sdk.Role.users()),
      sdk.Permission.update(sdk.Role.users()),
      sdk.Permission.delete(sdk.Role.users()),
    ], true)
    console.log('created.')
    await wait(800)
  }

  // Check attributes
  let existingAttrs = []
  try {
    const list = await db.listAttributes(DB_ID, col.id)
    existingAttrs = list.attributes.map((a) => a.key)
  } catch { /* empty */ }

  for (const attr of col.attributes) {
    if (existingAttrs.includes(attr.key)) continue
    process.stdout.write(`    + attribute ${attr.key} (${attr.type})... `)
    try {
      if (attr.type === 'string') {
        await db.createStringAttribute(DB_ID, col.id, attr.key, attr.size || 255, attr.required, attr.default, attr.array || false)
      } else if (attr.type === 'integer') {
        await db.createIntegerAttribute(DB_ID, col.id, attr.key, attr.required, undefined, undefined, attr.default, attr.array || false)
      } else if (attr.type === 'float') {
        await db.createFloatAttribute(DB_ID, col.id, attr.key, attr.required, undefined, undefined, attr.default, attr.array || false)
      } else if (attr.type === 'boolean') {
        await db.createBooleanAttribute(DB_ID, col.id, attr.key, attr.required, attr.default, attr.array || false)
      } else if (attr.type === 'datetime') {
        await db.createDatetimeAttribute(DB_ID, col.id, attr.key, attr.required, attr.default, attr.array || false)
      } else if (attr.type === 'enum') {
        await db.createEnumAttribute(DB_ID, col.id, attr.key, attr.elements, attr.required, attr.default, attr.array || false)
      }
      console.log('done.')
      await wait(400)
    } catch (err) {
      console.log(`note: ${err.message}`)
    }
  }
}

async function ensureStorage() {
  process.stdout.write('• Storage bucket "attachments"... ')
  try {
    await storage.getBucket('attachments')
    console.log('exists.')
  } catch {
    await storage.createBucket('attachments', 'Assignment Attachments', [
      sdk.Permission.read(sdk.Role.users()),
      sdk.Permission.create(sdk.Role.users()),
      sdk.Permission.update(sdk.Role.users()),
      sdk.Permission.delete(sdk.Role.users()),
    ], false, true, 50000000)
    console.log('created.')
  }
}

(async () => {
  try {
    await ensureDatabase()
    for (const c of COLLECTIONS) {
      await ensureCollection(c)
    }
    await ensureStorage()
    console.log('\n✅ Appwrite Cloud project provisioned successfully!')
    console.log('   Flip VITE_DEMO_MODE=false in your .env to connect to live Appwrite.\n')
  } catch (err) {
    console.error('\n❌ Provisioning failed:', err.message)
    if (err.message && err.message.toLowerCase().includes('region')) {
      console.log('\n------------------------------------------------------------')
      console.log('👉 HOW TO FIX THIS REGION MISMATCH:')
      console.log('   Appwrite Cloud projects are hosted in specific regions.')
      console.log('   1. Open your project on https://cloud.appwrite.io')
      console.log('   2. Click "Project Settings" (gear icon in left sidebar)')
      console.log('   3. Under "API Endpoint", copy your exact regional URL.')
      console.log('      Common regions:')
      console.log('        • Frankfurt (EU):      https://fra.cloud.appwrite.io/v1')
      console.log('        • London (UK):         https://lon.cloud.appwrite.io/v1')
      console.log('        • New York (US East):  https://nyc.cloud.appwrite.io/v1')
      console.log('        • San Francisco (US):  https://sfo.cloud.appwrite.io/v1')
      console.log('        • Singapore (AP):      https://sgp.cloud.appwrite.io/v1')
      console.log('        • Sydney (Oceania):    https://syd.cloud.appwrite.io/v1')
      console.log('   4. In your .env file, set:')
      console.log('      VITE_APPWRITE_ENDPOINT=https://<your-region>.cloud.appwrite.io/v1')
      console.log('   5. Re-run: npm run setup:appwrite')
      console.log('------------------------------------------------------------\n')
    }
    process.exitCode = 1
  }
})()
