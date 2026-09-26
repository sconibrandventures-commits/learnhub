import { Client, Account, Databases, Storage, Teams, Functions, Query, Permission, Role, ID } from 'appwrite'
import { config } from '../config'

let client = null

function getClient() {
  if (client) return client
  client = new Client()
  client.setEndpoint(config.endpoint).setProject(config.projectId)
  return client
}

/**
 * Lazy singletons. Created on first use so that importing this module in demo
 * mode never throws (there's no project id to point at).
 */
export function appwrite() {
  const c = getClient()
  return {
    client: c,
    account: new Account(c),
    databases: new Databases(c),
    storage: new Storage(c),
    teams: new Teams(c),
    functions: new Functions(c),
  }
}

export { Query, Permission, Role, ID }

/** Build the array of permissions for a document belonging to `course`. */
export function courseContentPermissions(course, { ownerWrite = true } = {}) {
  const teamId = course.teamId
  if (!teamId) return []
  const read = [Permission.read(Role.team(teamId)), Permission.read(Role.label('admin'))]
  if (!ownerWrite) return read
  return [
    ...read,
    Permission.update(Role.team(teamId, 'owner')),
    Permission.update(Role.label('admin')),
    Permission.delete(Role.team(teamId, 'owner')),
    Permission.delete(Role.label('admin')),
  ]
}

/** Human-readable message for an Appwrite error. */
export function errorMessage(err) {
  if (!err) return 'Something went wrong.'
  if (typeof err === 'string') return err
  const code = err.code || 0
  const map = {
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to do that.',
    404: 'That item could not be found.',
    409: 'That already exists.',
    429: 'Too many attempts. Please wait a moment and try again.',
  }
  if (map[code]) return map[code]
  // Appwrite puts useful text in err.message / err.response.message
  return err.message || err.response?.message || 'Something went wrong.'
}
