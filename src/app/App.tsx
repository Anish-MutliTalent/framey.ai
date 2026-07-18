import { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Auth / Login
import { ERPLogin } from './pages/ERPLogin';

// Learning viewer (no ERP sidebar — full screen)
import { LearningViewer } from './pages/LearningViewer';

// ── Student pages ──────────────────────────────────────────────────────────────
import { StudentDashboard }     from './pages/student/StudentDashboard';
import { StudentClasses }       from './pages/student/StudentClasses';
import { StudentClassroom }     from './pages/student/StudentClassroom';
import { StudentCustomClassroom } from './pages/student/StudentCustomClassroom';
import { PostDetail }           from './components/classroom/PostDetail';
import { StudentSubmissionViewer } from './components/classroom/StudentSubmissionViewer';
import { StudentDiary }         from './pages/student/StudentDiary';
import { StudentTimetable }     from './pages/student/StudentTimetable';
import { StudentAttendance }    from './pages/student/StudentAttendance';
import { StudentReports }       from './pages/student/StudentReports';
import { StudentAnnouncements } from './pages/student/StudentAnnouncements';
import { StudentCalendar }      from './pages/student/StudentCalendar';
// Tools
import { StudentAITutor }       from './pages/student/StudentAITutor';
import { StudentLibrary }       from './pages/student/StudentLibrary';
import { StudentNotes }         from './pages/student/StudentNotes';
import { StudentProgress }      from './pages/student/StudentProgress';
import { StudentProjects }          from './pages/student/StudentProjects';
import { StudentProjectWorkspace }  from './pages/student/StudentProjectWorkspace';
import { StudentMessages }      from './pages/student/StudentMessages';
import { StudentCollaboration } from './pages/student/StudentCollaboration';
import { StudentWellness }      from './pages/student/StudentWellness';

// ── Teacher pages ─────────────────────────────────────────────────────────────
import { TeacherDashboard }     from './pages/teacher/TeacherDashboard';
import { TeacherClasses }       from './pages/teacher/TeacherClasses';
import { TeacherClassroom }     from './pages/teacher/TeacherClassroom';
import { TeacherCustomClassroom } from './pages/teacher/TeacherCustomClassroom';
import { TeacherAttendance }    from './pages/teacher/TeacherAttendance';
import { TeacherTimetable }     from './pages/teacher/TeacherTimetable';
import { TeacherGradebook }     from './pages/teacher/TeacherGradebook';
import { TeacherReports }       from './pages/teacher/TeacherReports';
import { TeacherAnnouncements } from './pages/teacher/TeacherAnnouncements';
import { TeacherCalendar }      from './pages/teacher/TeacherCalendar';
import { TeacherHomework }  from './pages/teacher/TeacherHomework';
import { TeacherStudents } from './pages/teacher/TeacherStudents';
// Teachers reuse the same messaging/collaboration pages — no role restriction in backend

// ── Admin pages ───────────────────────────────────────────────────────────────
import { AdminDashboard }  from './pages/admin/AdminDashboard';
import { AdminUsers }      from './pages/admin/AdminUsers';
import { AdminClasses }    from './pages/admin/AdminClasses';
import { AdminSubjects }   from './pages/admin/AdminSubjects';
import { AdminConfig }     from './pages/admin/AdminConfig';
import { AdminAudit }      from './pages/admin/AdminAudit';
import { AdminTasks }      from './pages/admin/AdminTasks';
import { AdminClassrooms } from './pages/admin/AdminClassrooms';
import { AdminHR }         from './pages/admin/AdminHR';
import { AdminCalendar }   from './pages/admin/AdminCalendar';
import { AdminReports }    from './pages/admin/AdminReports';

// ── Counselor / Nurse ───────────────────────────────────────────────────────
import { CounselorDashboard } from './pages/counselor/CounselorDashboard';
import { NurseDashboard }     from './pages/nurse/NurseDashboard';
import { NurseConditions }    from './pages/nurse/NurseConditions';

// ── Helpers ───────────────────────────────────────────────────────────────────
function RoleRouter() {
  const { user, loading, primaryRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  const role = primaryRole();
  if (role === 'student') return <Navigate to="/student" replace />;
  if (role === 'teacher' || role === 'class_teacher') return <Navigate to="/teacher" replace />;
  if (role === 'counselor') return <Navigate to="/counselor" replace />;
  if (role === 'nurse') return <Navigate to="/nurse" replace />;
  return <Navigate to="/admin" replace />;
}

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <ERPLogin />;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F5F0' }}>
      <div className="w-7 h-7 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
    </div>
  );
}

const STUDENT = ['student'];
const TEACHER = ['teacher','class_teacher','coordinator','principal','tech_admin'];
const ADMIN   = ['tech_admin','principal','coordinator'];
const COUNSELOR = ['counselor'];
const NURSE = ['nurse'];

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginRoute />} />

          {/* Root redirect */}
          <Route path="/" element={<RoleRouter />} />

          {/* Learning viewer — no sidebar */}
          <Route path="/learning" element={<ProtectedRoute><LearningViewer /></ProtectedRoute>} />

          {/* ── Student ──────────────────────────────────────────────────── */}
          <Route path="/student"                element={<ProtectedRoute roles={STUDENT}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/classroom"          element={<ProtectedRoute roles={STUDENT}><StudentClasses /></ProtectedRoute>} />
          <Route path="/student/classroom/:sectionId/:subjectId" element={<ProtectedRoute roles={STUDENT}><StudentClassroom /></ProtectedRoute>} />
          <Route path="/student/classroom/custom/:classroomId" element={<ProtectedRoute roles={STUDENT}><StudentCustomClassroom /></ProtectedRoute>} />
          <Route path="/student/classroom/post/:postId" element={<ProtectedRoute roles={STUDENT}><PostDetail role="student" /></ProtectedRoute>} />
          <Route path="/student/diary"          element={<ProtectedRoute roles={STUDENT}><StudentDiary /></ProtectedRoute>} />
          <Route path="/student/timetable"      element={<ProtectedRoute roles={STUDENT}><StudentTimetable /></ProtectedRoute>} />
          <Route path="/student/attendance"     element={<ProtectedRoute roles={STUDENT}><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/reports"        element={<ProtectedRoute roles={STUDENT}><StudentReports /></ProtectedRoute>} />
          <Route path="/student/announcements"  element={<ProtectedRoute roles={STUDENT}><StudentAnnouncements /></ProtectedRoute>} />
          <Route path="/student/calendar"       element={<ProtectedRoute roles={STUDENT}><StudentCalendar /></ProtectedRoute>} />
          {/* Student Tools */}
          <Route path="/student/ai-tutor"      element={<ProtectedRoute roles={STUDENT}><StudentAITutor /></ProtectedRoute>} />
          <Route path="/student/library"       element={<ProtectedRoute roles={STUDENT}><StudentLibrary /></ProtectedRoute>} />
          <Route path="/student/notes"         element={<ProtectedRoute roles={STUDENT}><StudentNotes /></ProtectedRoute>} />
          <Route path="/student/progress"      element={<ProtectedRoute roles={STUDENT}><StudentProgress /></ProtectedRoute>} />
          <Route path="/student/projects"          element={<ProtectedRoute roles={STUDENT}><StudentProjects /></ProtectedRoute>} />
          <Route path="/student/projects/:projectId" element={<ProtectedRoute roles={STUDENT}><StudentProjectWorkspace /></ProtectedRoute>} />
          <Route path="/student/messages"      element={<ProtectedRoute roles={STUDENT}><StudentMessages /></ProtectedRoute>} />
          <Route path="/student/collaboration" element={<ProtectedRoute roles={STUDENT}><StudentCollaboration /></ProtectedRoute>} />
          <Route path="/student/wellness"      element={<ProtectedRoute roles={STUDENT}><StudentWellness /></ProtectedRoute>} />

          {/* ── Teacher ──────────────────────────────────────────────────── */}
          <Route path="/teacher"               element={<ProtectedRoute roles={TEACHER}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/classroom"          element={<ProtectedRoute roles={TEACHER}><TeacherClasses /></ProtectedRoute>} />
          <Route path="/teacher/classroom/:sectionId/:subjectId" element={<ProtectedRoute roles={TEACHER}><TeacherClassroom /></ProtectedRoute>} />
          <Route path="/teacher/classroom/custom/:classroomId" element={<ProtectedRoute roles={TEACHER}><TeacherCustomClassroom /></ProtectedRoute>} />
          <Route path="/teacher/classroom/post/:postId" element={<ProtectedRoute roles={TEACHER}><PostDetail role="teacher" /></ProtectedRoute>} />
          <Route path="/teacher/classroom/post/:postId/student/:studentId" element={<ProtectedRoute roles={TEACHER}><StudentSubmissionViewer /></ProtectedRoute>} />
          <Route path="/teacher/attendance"    element={<ProtectedRoute roles={TEACHER}><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/teacher/timetable"     element={<ProtectedRoute roles={TEACHER}><TeacherTimetable /></ProtectedRoute>} />
          <Route path="/teacher/gradebook"     element={<ProtectedRoute roles={TEACHER}><TeacherGradebook /></ProtectedRoute>} />
          <Route path="/teacher/reports"       element={<ProtectedRoute roles={TEACHER}><TeacherReports /></ProtectedRoute>} />
          <Route path="/teacher/announcements"  element={<ProtectedRoute roles={TEACHER}><TeacherAnnouncements /></ProtectedRoute>} />
          <Route path="/teacher/calendar"       element={<ProtectedRoute roles={TEACHER}><TeacherCalendar /></ProtectedRoute>} />
          <Route path="/teacher/homework"       element={<ProtectedRoute roles={TEACHER}><TeacherHomework /></ProtectedRoute>} />
          <Route path="/teacher/students"       element={<ProtectedRoute roles={TEACHER}><TeacherStudents /></ProtectedRoute>} />
          <Route path="/teacher/messages"       element={<ProtectedRoute roles={TEACHER}><StudentMessages /></ProtectedRoute>} />
          <Route path="/teacher/collaboration"  element={<ProtectedRoute roles={TEACHER}><StudentCollaboration /></ProtectedRoute>} />

          {/* ── Admin ────────────────────────────────────────────────────── */}
          <Route path="/admin"          element={<ProtectedRoute roles={ADMIN}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users"    element={<ProtectedRoute roles={ADMIN}><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/classes"     element={<ProtectedRoute roles={ADMIN}><AdminClasses /></ProtectedRoute>} />
          <Route path="/admin/classrooms"  element={<ProtectedRoute roles={ADMIN}><AdminClassrooms /></ProtectedRoute>} />
          <Route path="/admin/subjects" element={<ProtectedRoute roles={ADMIN}><AdminSubjects /></ProtectedRoute>} />
          <Route path="/admin/config"   element={<ProtectedRoute roles={['tech_admin']}><AdminConfig /></ProtectedRoute>} />
          <Route path="/admin/audit"    element={<ProtectedRoute roles={['tech_admin']}><AdminAudit /></ProtectedRoute>} />
          <Route path="/admin/tasks"    element={<ProtectedRoute roles={ADMIN}><AdminTasks /></ProtectedRoute>} />
          <Route path="/admin/hr"       element={<ProtectedRoute roles={ADMIN}><AdminHR /></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute roles={ADMIN}><AdminCalendar /></ProtectedRoute>} />
          <Route path="/admin/reports"  element={<ProtectedRoute roles={ADMIN}><AdminReports /></ProtectedRoute>} />

          {/* ── Counselor / Nurse ────────────────────────────────────────── */}
          <Route path="/counselor" element={<ProtectedRoute roles={COUNSELOR}><CounselorDashboard /></ProtectedRoute>} />
          <Route path="/nurse"     element={<ProtectedRoute roles={NURSE}><NurseDashboard /></ProtectedRoute>} />
          <Route path="/nurse/conditions" element={<ProtectedRoute roles={NURSE}><NurseConditions /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
