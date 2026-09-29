import { useState, useRef } from 'react'
import backend from '../../lib/backend'
import { Modal, Icon, Badge, Spinner } from '../../components/ui'

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'Hub'
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code + '!'
}

function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((c === ',' || c === '\t' || c === ';') && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur.trim())
  return result
}

export default function BulkUserModal({ onClose, onImportComplete }) {
  const fileInputRef = useRef(null)
  const [activeTab, setActiveTab] = useState('paste') // 'paste' | 'file'
  const [rawText, setRawText] = useState('')
  const [defaultRole, setDefaultRole] = useState('student')
  const [parsedRows, setParsedRows] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [isCompleted, setIsCompleted] = useState(false)

  // Parse lines whenever rawText or defaultRole changes
  function handleParse(textToParse, roleDefault = defaultRole) {
    if (!textToParse || !textToParse.trim()) {
      setParsedRows([])
      return
    }

    const lines = textToParse
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      setParsedRows([])
      return
    }

    let startIndex = 0
    // Detect header row if it contains 'name' or 'email'
    const firstLineLower = lines[0].toLowerCase()
    if (firstLineLower.includes('email') || firstLineLower.includes('name')) {
      startIndex = 1
    }

    const seenEmails = new Set()
    const rows = []

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i])
      if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue

      let name = ''
      let email = ''
      let password = ''
      let role = roleDefault

      // Smart column assignment:
      // If column 0 is email and column 1 is name, or vice versa:
      if (parts[0] && parts[0].includes('@')) {
        email = parts[0]
        name = parts[1] || ''
        password = parts[2] || ''
        role = parts[3] || roleDefault
      } else {
        name = parts[0] || ''
        email = parts[1] || ''
        password = parts[2] || ''
        role = parts[3] || roleDefault
      }

      // Normalise role
      const r = (role || '').toLowerCase().trim()
      const normalizedRole = ['admin', 'instructor', 'student'].includes(r) ? r : roleDefault

      const cleanEmail = email.toLowerCase().trim()
      const cleanName = name.trim()
      const generatedPass = password && password.length >= 8 ? password.trim() : generatePassword()

      let validationError = ''
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        validationError = 'Invalid email'
      } else if (!cleanName) {
        validationError = 'Missing name'
      } else if (seenEmails.has(cleanEmail)) {
        validationError = 'Duplicate email in batch'
      } else {
        seenEmails.add(cleanEmail)
      }

      rows.push({
        id: `row_${i}_${Date.now()}`,
        name: cleanName || 'Unnamed User',
        email: cleanEmail,
        password: generatedPass,
        role: normalizedRole,
        valid: !validationError,
        error: validationError,
        status: validationError ? 'invalid' : 'pending', // pending, running, done, failed, invalid
      })
    }

    setParsedRows(rows)
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result || ''
      setRawText(content)
      handleParse(content)
    }
    reader.readAsText(file)
  }

  function handleRoleChange(newRole) {
    setDefaultRole(newRole)
    if (rawText) {
      handleParse(rawText, newRole)
    }
  }

  function downloadSampleCsv() {
    const sample = `Full Name,Email Address,Password (optional),Role (optional)
Chinedu Okafor,chinedu.okafor@example.com,Pass1234!,student
Amina Mohammed,amina.m@example.com,,student
Babatunde Adeleke,babatunde@example.com,,instructor`

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learnhub_bulk_users_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadCredentialsCsv() {
    const headers = 'Full Name,Email Address,Password,Role,Status,Details\n'
    const body = parsedRows
      .map((r) => {
        const cleanName = `"${r.name.replace(/"/g, '""')}"`
        const cleanErr = `"${(r.error || '').replace(/"/g, '""')}"`
        return `${cleanName},${r.email},${r.password},${r.role},${r.status},${cleanErr}`
      })
      .join('\n')

    const blob = new Blob([headers + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imported_users_credentials_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function startImport() {
    const validRows = parsedRows.filter((r) => r.valid && r.status !== 'done')
    if (validRows.length === 0) return

    setIsProcessing(true)
    setIsCompleted(false)

    let successCount = 0
    let failCount = 0
    const total = validRows.length

    setProgress({ current: 0, total, success: 0, failed: 0 })

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]

      // Mark running
      setParsedRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: 'running' } : r))
      )

      try {
        await backend.createUser({
          name: row.name,
          email: row.email,
          password: row.password,
          role: row.role,
        })

        successCount++
        setParsedRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: 'done', error: '' } : r))
        )
      } catch (err) {
        failCount++
        setParsedRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, status: 'failed', error: err.message || 'Creation failed' } : r
          )
        )
      }

      setProgress({
        current: i + 1,
        total,
        success: successCount,
        failed: failCount,
      })

      // Polite delay between account creations to prevent rate limiting
      await new Promise((res) => setTimeout(res, 200))
    }

    setIsProcessing(false)
    setIsCompleted(true)
    if (onImportComplete) {
      onImportComplete()
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const percentDone = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <Modal
      title="Bulk Import Users"
      onClose={isProcessing ? undefined : onClose}
      width={780}
      footer={
        <div className="row row--between" style={{ width: '100%' }}>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={downloadSampleCsv}
          >
            <Icon name="download" size={14} /> Download Sample CSV
          </button>

          <div className="row" style={{ gap: 8 }}>
            {isCompleted && (
              <button
                type="button"
                className="btn btn--ok btn--sm"
                onClick={downloadCredentialsCsv}
              >
                <Icon name="download" size={14} /> Export Credentials CSV
              </button>
            )}

            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isProcessing}
            >
              {isCompleted ? 'Close' : 'Cancel'}
            </button>

            {!isCompleted && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={startImport}
                disabled={isProcessing || validCount === 0}
              >
                {isProcessing ? (
                  <>
                    <Spinner size={14} /> Importing ({progress.current}/{progress.total})…
                  </>
                ) : (
                  <>
                    <Icon name="upload" size={14} /> Import {validCount} User{validCount === 1 ? '' : 's'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        {/* Banner with guidelines */}
        <div className="alert alert--info" style={{ fontSize: '.86rem', lineHeight: 1.5 }}>
          <div>
            <b>Automated Email Notification & Passwords:</b>
            <div>
              Each imported user will automatically receive a welcome email with their login credentials.
              If you leave passwords blank, a secure random password will be auto-generated for them.
            </div>
          </div>
        </div>

        {/* Input Controls */}
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={activeTab === 'paste' ? 'active' : ''}
              onClick={() => setActiveTab('paste')}
            >
              Paste Text / Excel
            </button>
            <button
              type="button"
              className={activeTab === 'file' ? 'active' : ''}
              onClick={() => setActiveTab('file')}
            >
              Upload CSV File
            </button>
          </div>

          <div className="field" style={{ margin: 0, minWidth: 190 }}>
            <label htmlFor="bulk-default-role" style={{ marginBottom: 4, fontSize: '.8rem' }}>
              Default Role if not specified:
            </label>
            <select
              id="bulk-default-role"
              value={defaultRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={isProcessing}
              style={{ padding: '6px 10px', fontSize: '.85rem' }}
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>

        {/* Tab 1: Paste Text */}
        {activeTab === 'paste' && (
          <div>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value)
                handleParse(e.target.value)
              }}
              disabled={isProcessing}
              placeholder={`Paste lines directly from Excel, Sheets or text (Name, Email, [Password], [Role]):
Chinedu Okafor, chinedu@example.com
Amina Yusuf, amina@example.com, Pass1234!, student
Babatunde Adeleke, babatunde@example.com,, instructor`}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '.85rem',
                minHeight: 120,
                width: '100%',
              }}
            />
            <div className="tiny muted mt-1">
              Supports comma, tab, or semicolon delimiters. Headers like "Name, Email" are automatically detected.
            </div>
          </div>
        )}

        {/* Tab 2: Upload CSV */}
        {activeTab === 'file' && (
          <div
            style={{
              border: '2px dashed var(--line-2)',
              borderRadius: 'var(--r)',
              padding: '30px 20px',
              textAlign: 'center',
              background: 'var(--bg)',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <Icon name="upload" size={32} style={{ color: 'var(--brand)', marginBottom: 8 }} />
            <div className="b">Click here to upload your .csv file</div>
            <div className="tiny muted mt-1">Accepts CSV or tab-delimited text files up to 500 rows</div>
          </div>
        )}

        {/* Progress bar during import */}
        {isProcessing && (
          <div className="card" style={{ padding: 14, background: 'var(--surface)' }}>
            <div className="row row--between mb-1" style={{ fontSize: '.84rem' }}>
              <span className="b">Importing users…</span>
              <span>
                {progress.current} of {progress.total} ({percentDone}%)
              </span>
            </div>
            <div className="progress">
              <span style={{ width: `${percentDone}%` }} />
            </div>
            <div className="row tiny muted mt-1" style={{ gap: 14 }}>
              <span style={{ color: 'var(--ok)' }}>✓ {progress.success} succeeded</span>
              {progress.failed > 0 && <span style={{ color: 'var(--danger)' }}>✕ {progress.failed} failed</span>}
            </div>
          </div>
        )}

        {/* Completion Banner */}
        {isCompleted && (
          <div className={`alert ${progress.failed === 0 ? 'alert--ok' : 'alert--warn'}`}>
            <div>
              <b>Import completed:</b> {progress.success} users successfully added.
              {progress.failed > 0 && ` ${progress.failed} failed (see details below).`}
              <div className="mt-1">
                You can click <b>"Export Credentials CSV"</b> below to keep a copy of their login credentials.
              </div>
            </div>
          </div>
        )}

        {/* Preview / Results Table */}
        {parsedRows.length > 0 && (
          <div>
            <div className="row row--between mb-1">
              <div className="b small">
                Preview & Verification ({validCount} valid of {parsedRows.length} rows)
              </div>
            </div>

            <div
              className="table-wrap"
              style={{
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Password</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, idx) => (
                    <tr key={r.id}>
                      <td className="tiny muted">{idx + 1}</td>
                      <td>
                        <div className="b small">{r.name}</div>
                      </td>
                      <td className="small mono">{r.email || <span className="muted">—</span>}</td>
                      <td className="tiny mono">{r.password}</td>
                      <td>
                        <Badge tone={r.role === 'admin' ? 'danger' : r.role === 'instructor' ? 'brand' : 'info'}>
                          {r.role}
                        </Badge>
                      </td>
                      <td>
                        {r.status === 'pending' && <span className="badge">Ready</span>}
                        {r.status === 'running' && (
                          <span className="badge badge--brand pulse">
                            <Spinner size={10} /> Creating…
                          </span>
                        )}
                        {r.status === 'done' && <Badge tone="ok">✓ Created</Badge>}
                        {r.status === 'failed' && (
                          <Badge tone="danger" title={r.error}>
                            ✕ {r.error || 'Failed'}
                          </Badge>
                        )}
                        {r.status === 'invalid' && <Badge tone="danger">{r.error}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
