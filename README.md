# LearnHub — Student Training Portal (Appwrite + React)

A complete video training portal where students attend live Zoom classes, submit assignments, take timed tests and exams, chat with classmates, and view recordings — with **strict course-level access control** backed by **Appwrite**.

---

## 🌟 Architecture & Security Model

The most important requirement is that **a student who logs in can ONLY access and join the live class of the course they are registered for**.

In Appwrite, this is enforced at two layers:

1. **Database & Team Permissions (Appwrite Layer)**:
   - Every course has an associated **Appwrite Team** (e.g. `team_course_<slug>`).
   - When a student is enrolled, they are added to that course's Team.
   - All classes, assignments, assessments, recordings, and chat messages for that course are saved with read permissions granted **only** to `Role.team(courseTeamId)` and `Role.label('admin')`.
   - Any student outside the team cannot read those documents from Appwrite — even by sending direct API calls.
   - When an admin or instructor suspends an enrolment, the student is removed from the Team, instantly terminating access.

2. **Frontend Guards (React Layer)**:
   - Every course route (`/courses/:courseId/*`) is wrapped in `<CourseProvider>`.
   - If an enrolled student attempts to open an unregistered course URL (e.g. `/courses/data-science-bootcamp`), they are immediately blocked with an **Access Denied** screen and redirected.
   - Live class Zoom links and passcodes are **never** rendered for non-enrolled students.

---

## 🚀 Quick Start (Zero-Setup Demo Mode)

The app includes a built-in browser demo backend (`localStorage`) preloaded with courses, classes, assignments, tests, and users. You can run and test everything without signing up for anything:

```bash
cd learnhub-appwrite
npm install
npm run dev
```

Visit `http://localhost:5173`. You will see the login screen with one-click demo login buttons:

| Account | Email | Password | What to test |
|---|---|---|---|
| 👑 **Administrator** | `admin@learnhub.test` | `password` | Master enrolment switch, user management, course approvals |
| 🧑‍🏫 **Instructor** | `teacher@learnhub.test` | `password` | Schedule live classes, create tests, mark written answers, view gradebook |
| 🎓 **Student (2 courses)** | `ngozi@learnhub.test` | `password` | Registered for both courses — full student workflow |
| 🎓 **Student (1 course)** | `tunde@learnhub.test` | `password` | **The enrolment lock** — try opening `/courses/data-science-bootcamp` |

---

## ⚡ Connecting to Appwrite Cloud

When you are ready to switch from Demo Mode to real Appwrite:

### Step 1: Create a Project on Appwrite Cloud
1. Sign up / log in at [cloud.appwrite.io](https://cloud.appwrite.io).
2. Click **Create Project** and name it (e.g. `LearnHub`).
3. Note your **Project ID** from the project dashboard settings.

### Step 2: Create an API Key for automated setup
1. In your Appwrite project dashboard, go to **Project Settings** -> **View API Keys** -> **Create API Key**.
2. Give it a name (e.g. `LearnHub Provisioner`).
3. Check the following scopes:
   - `databases.read`, `databases.write`
   - `collections.read`, `collections.write`
   - `attributes.read`, `attributes.write`
   - `buckets.read`, `buckets.write`
   - `teams.read`, `teams.write`
   - `users.read`, `users.write`
4. Copy the secret API key.

### Step 3: Configure `.env`
In `learnhub-appwrite/.env`:

```env
# Copy the exact "API Endpoint" from your project settings in Appwrite Console:
# e.g. Frankfurt:  https://fra.cloud.appwrite.io/v1
#      New York:   https://nyc.cloud.appwrite.io/v1
#      London:     https://lon.cloud.appwrite.io/v1
#      Singapore:  https://sgp.cloud.appwrite.io/v1
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_api_key_here
VITE_DEMO_MODE=false
```

### Step 4: Run the automated provisioner
Run this command once:

```bash
npm run setup:appwrite
```

This automatically creates:
- The `learnhub` database
- All 13 collections (`profiles`, `courses`, `enrolments`, `classes`, `attendance`, `assignments`, `submissions`, `questions`, `assessments`, `assessment_questions`, `attempts`, `announcements`, `messages`, `recordings`)
- All required attributes (strings, integers, enums, arrays, datetimes, booleans)
- The `attachments` storage bucket for assignment file uploads

Once provisioned, delete `APPWRITE_API_KEY` from your `.env` (it is only needed for the initial provisioning script).

---

## 🎥 Zoom Integration

Instructors can attach Zoom sessions to any class in two ways:

1. **Direct Zoom link (No setup required)**:
   - In Zoom (desktop or web), schedule your meeting.
   - Copy the Meeting ID, Passcode, and Join URL.
   - Paste them into the **Schedule Class** modal in LearnHub.
   - The portal gives students an **Open in Zoom** button, displays copyable meeting credentials, and runs a live attendance ping that tracks time present in class.

2. **Server-to-Server OAuth (Automated)**:
   - If configured with Appwrite Cloud Functions, meeting creation and cloud recording ingestion can be automated via Zoom's REST API.

---

## 📦 Deployment

### Static Hosting (Vercel, Netlify, Cloudflare Pages, GitHub Pages)
Run:
```bash
npm run build
```
Upload the generated `dist/` directory to any static host. All paths use relative asset resolution (`base: './'`).

### Docker / VPS
A simple Nginx container serving `dist/` or `npm run preview` will run the frontend on any Linux VPS or container platform.

---

## 📁 Project Structure

```
learnhub-appwrite/
├── setup/
│   └── provision.mjs        # Automated Appwrite Cloud collection & schema setup
├── src/
│   ├── config.js            # App config & Appwrite collection IDs
│   ├── styles.css           # Clean, responsive CSS design system (no external CDNs)
│   ├── lib/
│   │   ├── appwrite.js      # Appwrite SDK client & permission helpers
│   │   ├── backend.js       # Unified backend interface
│   │   ├── demoBackend.js   # In-browser localStorage demo backend
│   │   ├── realBackend.js   # Live Appwrite Cloud backend implementation
│   │   └── helpers.js       # Dates, countdowns, class window calculations
│   ├── state/
│   │   ├── AuthContext.jsx  # Authentication & role-based routing
│   │   ├── CourseContext.jsx# Strict course-level enrolment gatekeeper
│   │   └── ToastContext.jsx # Toast notifications
│   ├── components/
│   │   ├── ui.jsx           # Badges, icons, buttons, modals, stats
│   │   └── Layout.jsx       # App shell & responsive sidebar
│   ├── pages/
│   │   ├── Auth.jsx         # Sign in & student registration
│   │   ├── Profile.jsx      # Student/instructor account & password management
│   │   ├── student/         # My Courses & Course Catalogue
│   │   ├── course/          # Course home, Classes, Join room, Assignments,
│   │   │                    # Tests, Test taking & results, Chat, Recordings
│   │   ├── instructor/      # Dashboard, Course manager, Question bank, Gradebook
│   │   └── admin/           # Dashboard, Enrolments access switch, Users, Courses
│   ├── App.jsx              # Application router & route guards
│   └── main.jsx             # React entry point
├── package.json
└── vite.config.js
```
