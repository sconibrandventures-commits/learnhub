import * as sdk from 'node-appwrite'

function normalizeEndpoint(raw) {
  if (!raw) return 'https://cloud.appwrite.io/v1'
  let u = String(raw).trim().replace(/^["']|["']$/g, '')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  u = u.replace(/\/+$/, '')
  if (!u.endsWith('/v1')) u += '/v1'
  return u
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { action, name, email, password, role, userId, isActive } = body
  const endpoint = normalizeEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  const projectId = (process.env.VITE_APPWRITE_PROJECT_ID || '').trim().replace(/^["']|["']$/g, '')
  const apiKey = (process.env.APPWRITE_API_KEY || '').trim().replace(/^["']|["']$/g, '')
  const dbId = 'learnhub'

  if (!projectId || !apiKey) {
    return {
      statusCode: 501,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No APPWRITE_API_KEY configured in Netlify environment variables' }),
    }
  }

  const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  const users = new sdk.Users(client)
  const db = new sdk.Databases(client)

  try {
    if (action === 'create') {
      const cleanEmail = String(email).trim().toLowerCase()
      const cleanName = String(name).trim()
      const targetRole = role || 'student'

      let user
      try {
        user = await users.create(sdk.ID.unique(), cleanEmail, undefined, password, cleanName)
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          const list = await users.list([sdk.Query.equal('email', cleanEmail)])
          user = list.users[0]
          if (password) await users.updatePassword(user.$id, password)
        } else {
          throw err
        }
      }

      // Add role label
      try {
        await users.updateLabels(user.$id, [targetRole])
      } catch { /* ignore */ }

      // Create or update profile document
      try {
        await db.updateDocument(dbId, 'profiles', user.$id, {
          name: cleanName,
          email: cleanEmail,
          role: targetRole,
          isActive: true,
        })
      } catch {
        await db.createDocument(
          dbId,
          'profiles',
          user.$id,
          {
            userId: user.$id,
            name: cleanName,
            email: cleanEmail,
            role: targetRole,
            isActive: true,
          },
          [
            sdk.Permission.read(sdk.Role.users()),
            sdk.Permission.update(sdk.Role.users()),
            sdk.Permission.delete(sdk.Role.users()),
          ]
        )
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          user: {
            $id: user.$id,
            name: cleanName,
            email: cleanEmail,
            role: targetRole,
            isActive: true,
            createdAt: user.$createdAt,
          },
        }),
      }
    }

    if (action === 'delete') {
      if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) }
      try { await users.delete(userId) } catch { /* ignore */ }
      try { await db.deleteDocument(dbId, 'profiles', userId) } catch { /* ignore */ }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    if (action === 'setRole') {
      if (!userId || !role) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) }
      try { await users.updateLabels(userId, [role]) } catch { /* ignore */ }
      try { await db.updateDocument(dbId, 'profiles', userId, { role }) } catch { /* ignore */ }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    if (action === 'setActive') {
      if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) }
      try { await users.updateStatus(userId, isActive !== false) } catch { /* ignore */ }
      try { await db.updateDocument(dbId, 'profiles', userId, { isActive: isActive !== false }) } catch { /* ignore */ }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Operation failed' }),
    }
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  let body = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const fakeEvent = {
    httpMethod: req.method,
    body: JSON.stringify(body),
  }

  const result = await handler(fakeEvent, {})
  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers || { 'Content-Type': 'application/json' },
  })
}