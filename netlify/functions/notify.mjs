import nodemailer from 'nodemailer'

/**
 * Universal Email Notification Service for LearnHub.
 *
 * Supported Email Providers:
 * 1. Resend (Recommended, zero-config free tier: 3,000 emails/mo)
 *    Set: RESEND_API_KEY (and optionally EMAIL_FROM)
 *
 * 2. SMTP (Gmail, Brevo, SendGrid, Mailgun, AWS SES, cPanel)
 *    Set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optionally EMAIL_FROM)
 *
 * 3. Fallback / Dev Mode
 *    If no email provider is configured, notifications are logged safely to the console.
 */

function wrapTemplate({ brandName = 'LearnHub', title, headline, bodyHtml, ctaText, ctaUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 30px 16px; box-sizing: border-box; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #1e293b; padding: 22px 28px; text-align: left; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 700; text-decoration: none; letter-spacing: -0.5px; }
    .header-tag { display: inline-block; background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 9999px; margin-left: 8px; text-transform: uppercase; }
    .content { padding: 32px 28px; }
    .headline { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.35; }
    .text { font-size: 15px; color: #475569; margin: 0 0 16px 0; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 16px 20px; margin: 22px 0; }
    .box-title { font-weight: 700; font-size: 15px; color: #1e293b; margin-bottom: 8px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .info-table td { padding: 6px 0; font-size: 14px; vertical-align: top; }
    .info-table .label { color: #64748b; font-weight: 600; width: 34%; }
    .info-table .value { color: #0f172a; font-weight: 500; }
    .code-pill { background: #e2e8f0; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; padding: 4px 8px; border-radius: 4px; font-weight: 600; }
    .button-wrap { text-align: center; margin: 32px 0 12px 0; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-align: center; }
    .footer { text-align: center; padding: 24px 20px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <span class="header-logo">🎓 ${brandName}</span>
        <span class="header-tag">Notification</span>
      </div>
      <div class="content">
        <div class="headline">${headline}</div>
        ${bodyHtml}
        ${ctaText && ctaUrl ? `
          <div class="button-wrap">
            <a href="${ctaUrl}" class="btn" target="_blank">${ctaText}</a>
          </div>
        ` : ''}
      </div>
    </div>
    <div class="footer">
      Automated update from ${brandName} · Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`
}

function formatDateSafe(val) {
  if (!val) return '—'
  try {
    const d = new Date(val)
    return d.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch {
    return String(val)
  }
}

function buildTemplate(type, payload, recipientName = 'Student') {
  const brandName = process.env.VITE_APP_NAME || 'LearnHub'

  switch (type) {
    case 'user_created': {
      const { name = recipientName, email, password, role = 'student', loginUrl } = payload
      const roleTitle = role.charAt(0).toUpperCase() + role.slice(1)
      const subject = `Welcome to ${brandName} — Your Login Credentials`
      const headline = `Welcome to ${brandName}, ${name}!`
      const bodyHtml = `
        <p class="text">Your account has been created with the role of <b>${roleTitle}</b>. You can now log in to access your portal, courses, live interactive classrooms, and assignments.</p>
        <div class="box">
          <div class="box-title">Your Login Credentials</div>
          <table class="info-table">
            <tr><td class="label">Portal URL:</td><td class="value"><a href="${loginUrl}">${loginUrl}</a></td></tr>
            <tr><td class="label">Login Email:</td><td class="value"><b>${email}</b></td></tr>
            <tr><td class="label">Temporary Password:</td><td class="value"><span class="code-pill">${password}</span></td></tr>
            <tr><td class="label">Account Role:</td><td class="value">${roleTitle}</td></tr>
          </table>
        </div>
        <p class="text" style="font-size: 13px; color: #64748b;">🔒 <b>Security Note:</b> For your safety, please sign in and change your password upon your first visit.</p>
      `
      const text = `Welcome to ${brandName}, ${name}!\n\nYour account role: ${roleTitle}\n\nLogin URL: ${loginUrl}\nEmail: ${email}\nPassword: ${password}\n\nPlease sign in and change your password.`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'Sign In to Portal', ctaUrl: loginUrl }), text }
    }

    case 'enrolment_activated': {
      const { name = recipientName, courseTitle, courseCode, instructorName, courseUrl } = payload
      const subject = `Enrolment Confirmed: ${courseTitle}`
      const headline = `You're Enrolled in ${courseTitle}`
      const bodyHtml = `
        <p class="text">Hello <b>${name}</b>,</p>
        <p class="text">Your enrolment for <b>${courseTitle}</b> has been approved and is now active.</p>
        <div class="box">
          <div class="box-title">Course Details</div>
          <table class="info-table">
            <tr><td class="label">Course Name:</td><td class="value"><b>${courseTitle}</b></td></tr>
            ${courseCode ? `<tr><td class="label">Course Code:</td><td class="value"><span class="code-pill">${courseCode}</span></td></tr>` : ''}
            <tr><td class="label">Instructor:</td><td class="value">${instructorName || 'Course Instructor'}</td></tr>
            <tr><td class="label">Access Status:</td><td class="value" style="color: #10b981; font-weight: 700;">● Active</td></tr>
          </table>
        </div>
        <p class="text">You can now access all upcoming live classes, study materials, announcements, and assessments for this course.</p>
      `
      const text = `Hello ${name},\n\nYour enrolment in ${courseTitle} (${courseCode || ''}) is active.\nInstructor: ${instructorName || 'Course Instructor'}\n\nAccess your course here: ${courseUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'Go to Course', ctaUrl: courseUrl }), text }
    }

    case 'announcement': {
      const { courseTitle, announcementTitle, announcementBody, authorName, courseUrl } = payload
      const subject = `New Announcement in ${courseTitle}: ${announcementTitle}`
      const headline = `New Course Announcement`
      const bodyHtml = `
        <p class="text">Hello <b>${recipientName}</b>,</p>
        <p class="text"><b>${authorName || 'The Instructor'}</b> posted a new announcement in <b>${courseTitle}</b>:</p>
        <div class="box">
          <div class="box-title">${announcementTitle}</div>
          <div style="font-size: 14px; color: #334155; white-space: pre-wrap; margin-top: 8px;">${announcementBody}</div>
        </div>
      `
      const text = `Hello ${recipientName},\n\nNew announcement in ${courseTitle} by ${authorName}:\n\n${announcementTitle}\n\n${announcementBody}\n\nView here: ${courseUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'View Announcement', ctaUrl: courseUrl }), text }
    }

    case 'assignment': {
      const { courseTitle, assignmentTitle, description, dueAt, maxScore, assignmentUrl } = payload
      const subject = `New Assignment in ${courseTitle}: ${assignmentTitle}`
      const headline = `New Assignment Posted`
      const formattedDue = dueAt ? formatDateSafe(dueAt) : 'No deadline'
      const bodyHtml = `
        <p class="text">Hello <b>${recipientName}</b>,</p>
        <p class="text">A new assignment has been given in <b>${courseTitle}</b>:</p>
        <div class="box">
          <div class="box-title">${assignmentTitle}</div>
          <table class="info-table">
            <tr><td class="label">Due Date:</td><td class="value"><b>${formattedDue}</b></td></tr>
            <tr><td class="label">Max Score:</td><td class="value">${maxScore || 10} points</td></tr>
          </table>
          ${description ? `<div style="font-size: 14px; color: #475569; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">${description}</div>` : ''}
        </div>
      `
      const text = `Hello ${recipientName},\n\nNew assignment in ${courseTitle}: ${assignmentTitle}\nDue Date: ${formattedDue}\nMax Score: ${maxScore || 10} points\n\nSubmit here: ${assignmentUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'View & Submit Assignment', ctaUrl: assignmentUrl }), text }
    }

    case 'class_scheduled': {
      const { courseTitle, classTitle, description, startsAt, durationMinutes, classUrl } = payload
      const subject = `Upcoming Live Class: ${classTitle} (${courseTitle})`
      const headline = `Live Class Scheduled`
      const formattedStart = startsAt ? formatDateSafe(startsAt) : 'TBD'
      const bodyHtml = `
        <p class="text">Hello <b>${recipientName}</b>,</p>
        <p class="text">A new live interactive class has been scheduled for <b>${courseTitle}</b>:</p>
        <div class="box">
          <div class="box-title">${classTitle}</div>
          <table class="info-table">
            <tr><td class="label">Date & Time:</td><td class="value"><b>${formattedStart}</b></td></tr>
            <tr><td class="label">Duration:</td><td class="value">${durationMinutes || 60} minutes</td></tr>
          </table>
          ${description ? `<div style="font-size: 14px; color: #475569; margin-top: 10px;">${description}</div>` : ''}
        </div>
        <p class="text" style="font-size: 13px; color: #64748b;">🔒 <b>Classroom Notice:</b> The secure Zoom classroom link unlocks 15 minutes before the class begins for actively enrolled students.</p>
      `
      const text = `Hello ${recipientName},\n\nLive Class Scheduled: ${classTitle}\nCourse: ${courseTitle}\nTime: ${formattedStart}\nDuration: ${durationMinutes || 60} mins\n\nClassroom: ${classUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'Go to Classroom', ctaUrl: classUrl }), text }
    }

    case 'submission_graded': {
      const { name = recipientName, courseTitle, assignmentTitle, score, maxScore, feedback, assignmentUrl } = payload
      const subject = `Assignment Graded: ${assignmentTitle} (${score}/${maxScore})`
      const headline = `Your Assignment Has Been Graded`
      const bodyHtml = `
        <p class="text">Hello <b>${name}</b>,</p>
        <p class="text">Your submission for <b>${assignmentTitle}</b> in <b>${courseTitle}</b> has been evaluated:</p>
        <div class="box">
          <div class="box-title">${assignmentTitle}</div>
          <table class="info-table">
            <tr><td class="label">Your Score:</td><td class="value" style="font-size: 17px; font-weight: 700; color: #4f46e5;">${score ?? 0} / ${maxScore ?? 10}</td></tr>
            ${feedback ? `<tr><td class="label">Instructor Feedback:</td><td class="value"><em>“${feedback}”</em></td></tr>` : ''}
          </table>
        </div>
      `
      const text = `Hello ${name},\n\nYour submission for ${assignmentTitle} (${courseTitle}) has been graded: ${score}/${maxScore} points.\nFeedback: ${feedback || 'None'}\n\nView here: ${assignmentUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: 'View Graded Submission', ctaUrl: assignmentUrl }), text }
    }

    case 'test_published': {
      const { courseTitle, testTitle, type: testType = 'test', durationMinutes, passMark, testUrl } = payload
      const kind = testType === 'exam' ? 'Exam' : 'Test'
      const subject = `New ${kind} Available: ${testTitle} (${courseTitle})`
      const headline = `New ${kind} Published`
      const bodyHtml = `
        <p class="text">Hello <b>${recipientName}</b>,</p>
        <p class="text">A new <b>${kind}</b> is now available in <b>${courseTitle}</b>:</p>
        <div class="box">
          <div class="box-title">${testTitle}</div>
          <table class="info-table">
            <tr><td class="label">Assessment Type:</td><td class="value">${kind}</td></tr>
            <tr><td class="label">Duration:</td><td class="value">${durationMinutes || 30} minutes</td></tr>
            <tr><td class="label">Pass Mark:</td><td class="value">${passMark || 50}%</td></tr>
          </table>
        </div>
      `
      const text = `Hello ${recipientName},\n\nA new ${kind} (${testTitle}) is available in ${courseTitle}.\nDuration: ${durationMinutes || 30} mins | Pass Mark: ${passMark || 50}%\n\nTake it here: ${testUrl}`
      return { subject, html: wrapTemplate({ brandName, title: subject, headline, bodyHtml, ctaText: `Start ${kind}`, ctaUrl: testUrl }), text }
    }

    default: {
      const subject = payload.subject || `Update from ${brandName}`
      const bodyHtml = `<p class="text">${payload.message || 'An update was posted on the platform.'}</p>`
      const text = payload.message || 'An update was posted on the platform.'
      return { subject, html: wrapTemplate({ brandName, title: subject, headline: subject, bodyHtml }), text }
    }
  }
}

async function deliverEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'LearnHub <onboarding@resend.dev>'

  // Strategy 1: Resend (Recommended)
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.message || `Resend delivery failed with HTTP ${res.status}`)
    }
    return { ok: true, provider: 'resend', id: data?.id }
  }

  // Strategy 2: SMTP (Nodemailer)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS.trim(),
      },
    })
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    })
    return { ok: true, provider: 'smtp', messageId: info.messageId }
  }

  // Strategy 3: Development / Fallback Logger
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`[LearnHub Email Simulated]`)
  console.log(`To:      ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`Preview: ${text.replace(/\n+/g, ' ').slice(0, 150)}...`)
  console.log('Notice: Set RESEND_API_KEY or SMTP_HOST in Netlify environment variables to send live emails.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return { ok: true, provider: 'simulated' }
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

  const { type, payload } = body
  if (!type || !payload) {
    return { statusCode: 400, body: JSON.stringify({ error: 'type and payload are required' }) }
  }

  // Determine recipients
  let recipients = []
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    recipients = payload.recipients
  } else if (payload.email) {
    recipients = [{ name: payload.name || 'User', email: payload.email }]
  }

  if (recipients.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, note: 'No recipients specified' }) }
  }

  const results = []
  for (const recipient of recipients) {
    const emailAddr = typeof recipient === 'string' ? recipient : recipient.email
    const recipientName = typeof recipient === 'string' ? 'Student' : (recipient.name || 'Student')
    if (!emailAddr) continue

    const { subject, html, text } = buildTemplate(type, payload, recipientName)

    try {
      const res = await deliverEmail({ to: emailAddr, subject, html, text })
      results.push({ email: emailAddr, status: 'sent', provider: res.provider })
    } catch (err) {
      console.error(`Failed to send email to ${emailAddr}:`, err.message)
      results.push({ email: emailAddr, status: 'error', error: err.message })
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, sent: results.filter((r) => r.status === 'sent').length, details: results }),
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
