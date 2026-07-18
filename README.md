# Academia — School ERP / LMS

Dark, premium school management platform. FastAPI + SQLite backend, React + Tailwind frontend. Google OAuth only.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy ORM, SQLite (`academia.db`) |
| Auth | Google OAuth (ID token verification), JWT |
| AI | Anthropic Claude (homework auto-detection) |
| Frontend | React 18, TypeScript, Tailwind CSS v4, Vite |
| Design | Inter UI, JetBrains Mono data, dark #0A0A0F base |

---

## Setup

### 1. Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorised JavaScript origins: `http://localhost:5173`
5. Copy the Client ID

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Edit `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=change-me-to-a-long-random-secret
ANTHROPIC_API_KEY=sk-ant-...
```

Seed the database with sample data:

```bash
cd backend
python seed.py
```

Start the API server:

```bash
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### 3. Frontend

```bash
# In project root
npm install   # or pnpm install
```

Edit `.env` in project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

```bash
npm run dev
```

Open `http://localhost:5173`

---

## Roles

| Role | Access |
|---|---|
| `student` | Dashboard, Classroom, Diary, Timetable, Attendance, Reports, Announcements, Calendar |
| `teacher` | Dashboard, Classroom (post), Attendance marking, Timetable, Gradebook, Reports, Announcements |
| `class_teacher` | All teacher access + edit class timetable |
| `coordinator` | Teacher access + admin panel (no tech config) |
| `principal` | Coordinator access |
| `tech_admin` | Full admin access: school config, user management, audit log |

Users can hold multiple roles simultaneously.

---

## First-time setup flow

1. Admin creates users via `POST /api/admin/users` (or edit seed.py)
2. Users log in with their school Google account — only pre-created emails are accepted
3. Tech admin assigns users to classes/sections and configures timetable

---

## Sample seed accounts

After running `python seed.py`, these email addresses are pre-registered (login with any Google account that uses these emails):

| Email | Role |
|---|---|
| `tech@springfield.edu` | Tech Admin |
| `principal@springfield.edu` | Principal |
| `coordinator@springfield.edu` | Coordinator |
| `alice@springfield.edu` | Teacher (Math) |
| `bob@springfield.edu` | Teacher + Class Teacher (9A) |
| `student1@springfield.edu` | Student (Emma Johnson, 9A) |
| `student4@springfield.edu` | Student (Noah Wilson, 9B) |

> Note: Google OAuth requires the actual Google account to use these emails. For local dev, update `seed.py` with your real Google email addresses, or the tech admin can update google_id in the DB after first login attempt.

---

## Project structure

```
Academia/
├── backend/
│   ├── main.py            # FastAPI app, auth routes
│   ├── database.py        # SQLite engine + session
│   ├── models.py          # All SQLAlchemy models
│   ├── schemas.py         # Pydantic v2 schemas
│   ├── auth.py            # Google OAuth + JWT + RBAC deps
│   ├── seed.py            # Sample data seeder
│   ├── requirements.txt
│   ├── routers/
│   │   ├── students.py    # Student dashboard, diary, marks, attendance
│   │   ├── teachers.py    # Teacher dashboard, sections
│   │   ├── admin.py       # Users, classes, subjects, tasks, audit
│   │   ├── classroom.py   # Posts, comments, submissions
│   │   ├── attendance.py  # Bulk mark, edit
│   │   ├── timetable.py   # CRUD timetable entries
│   │   ├── reports.py     # Gradebook, report generation
│   │   ├── announcements.py
│   │   └── calendar.py
│   └── services/
│       ├── ai_diary.py    # Claude API: homework detection
│       └── grading.py     # Percentage / GPA / CBSE grading
└── src/
    └── app/
        ├── App.tsx                    # Routes + role-based guards
        ├── contexts/AuthContext.tsx   # Google OAuth + JWT state
        ├── hooks/useApi.ts            # Authenticated fetch helper
        ├── components/erp/
        │   ├── Layout.tsx             # Sidebar + TopBar wrapper
        │   ├── ERPSidebar.tsx         # Role-aware nav
        │   └── TopBar.tsx
        └── pages/
            ├── ERPLogin.tsx
            ├── student/               # 8 student pages
            ├── teacher/               # 8 teacher pages
            └── admin/                 # 10 admin pages
```

---

## AI features

When a teacher creates an `assignment` post, the backend calls Claude (`claude-haiku-4-5`) to detect whether the post is homework. If yes, `DiaryEntry` records are automatically created for every student in the section.

Set `ANTHROPIC_API_KEY` in `backend/.env` to enable this. Without the key the service defaults to `False` (no auto-diary).
