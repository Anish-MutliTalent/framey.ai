import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import {
  LayoutDashboard, BookOpen, CalendarDays, ClipboardList,
  Users, BookMarked, BarChart2, Bell, Settings, LogOut,
  GraduationCap, ClipboardCheck, UserCog, Calendar,
  FileText, Clock, MessageSquare, StickyNote, TrendingUp,
  FolderKanban, Heart, Sparkles, BookText, Users2, Activity,
} from 'lucide-react';

interface NavItem { to: string; icon: ReactNode; label: string; }

const studentNav: NavItem[] = [
  { to: '/student',                icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
  { to: '/student/classroom',      icon: <BookOpen size={15} />,        label: 'Classroom' },
  { to: '/student/diary',          icon: <BookMarked size={15} />,      label: 'Diary' },
  { to: '/student/timetable',      icon: <Clock size={15} />,           label: 'Timetable' },
  { to: '/student/attendance',     icon: <ClipboardCheck size={15} />,  label: 'Attendance' },
  { to: '/student/reports',        icon: <BarChart2 size={15} />,       label: 'Report Card' },
  { to: '/student/announcements',  icon: <Bell size={15} />,            label: 'Announcements' },
  { to: '/student/calendar',       icon: <CalendarDays size={15} />,    label: 'Calendar' },
  // ── Tools ──────────────────────────────────────────
  { to: '/student/ai-tutor',       icon: <Sparkles size={15} />,        label: 'AI Tutor' },
  { to: '/student/library',        icon: <BookText size={15} />,        label: 'Library' },
  { to: '/student/notes',          icon: <StickyNote size={15} />,      label: 'Notes' },
  { to: '/student/progress',       icon: <TrendingUp size={15} />,      label: 'Progress' },
  { to: '/student/projects',       icon: <FolderKanban size={15} />,    label: 'Projects' },
  { to: '/student/messages',       icon: <MessageSquare size={15} />,   label: 'Messages' },
  { to: '/student/collaboration',  icon: <Users2 size={15} />,          label: 'Collaboration' },
  { to: '/student/wellness',       icon: <Heart size={15} />,           label: 'Wellness' },
];

const teacherNav: NavItem[] = [
  { to: '/teacher',                icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
  { to: '/teacher/classroom',      icon: <BookOpen size={15} />,        label: 'Classroom' },
  { to: '/teacher/homework',       icon: <BookMarked size={15} />,      label: 'Homework' },
  { to: '/teacher/attendance',     icon: <ClipboardCheck size={15} />,  label: 'Attendance' },
  { to: '/teacher/timetable',      icon: <Clock size={15} />,           label: 'Timetable' },
  { to: '/teacher/gradebook',      icon: <FileText size={15} />,        label: 'Gradebook' },
  { to: '/teacher/students',       icon: <Users size={15} />,           label: 'My Students' },
  { to: '/teacher/reports',        icon: <BarChart2 size={15} />,       label: 'Reports' },
  { to: '/teacher/announcements',  icon: <Bell size={15} />,            label: 'Announcements' },
  { to: '/teacher/calendar',       icon: <CalendarDays size={15} />,    label: 'Calendar' },
  { to: '/teacher/messages',       icon: <MessageSquare size={15} />,   label: 'Messages' },
  { to: '/teacher/collaboration',  icon: <Users2 size={15} />,          label: 'Collaboration' },
];

const adminNav: NavItem[] = [
  { to: '/admin',          icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
  { to: '/admin/users',    icon: <Users size={15} />,           label: 'Users' },
  { to: '/admin/classes',     icon: <GraduationCap size={15} />,   label: 'Classes' },
  { to: '/admin/classrooms',  icon: <BookOpen size={15} />,        label: 'Classrooms' },
  { to: '/admin/subjects', icon: <BookOpen size={15} />,        label: 'Subjects' },
  { to: '/admin/hr',       icon: <UserCog size={15} />,         label: 'HR / Staff' },
  { to: '/admin/tasks',    icon: <ClipboardList size={15} />,   label: 'Tasks' },
  { to: '/admin/reports',  icon: <BarChart2 size={15} />,       label: 'Reports' },
  { to: '/admin/calendar', icon: <Calendar size={15} />,        label: 'Calendar' },
  { to: '/admin/config',   icon: <Settings size={15} />,        label: 'Config' },
  { to: '/admin/audit',    icon: <FileText size={15} />,        label: 'Audit Log' },
];

const counselorNav: NavItem[] = [
  { to: '/counselor', icon: <LayoutDashboard size={15} />, label: 'Counseling' },
];

const nurseNav: NavItem[] = [
  { to: '/nurse', icon: <LayoutDashboard size={15} />, label: 'Infirmary' },
  { to: '/nurse/conditions', icon: <Activity size={15} />, label: 'Medical Conditions' },
];

// Group labels for the student nav
const STUDENT_SECTIONS = [
  { label: 'School', count: 8 },
  { label: 'Tools', count: 8 },
];

export function ERPSidebar() {
  const { user, hasRole, logout, primaryRole } = useAuth();
  const role = primaryRole();

  let navItems = studentNav;
  let roleLabel = 'Student';
  const isStudent = hasRole('student') && !hasRole('teacher', 'class_teacher', 'coordinator', 'principal', 'tech_admin');

  if (hasRole('tech_admin', 'principal', 'coordinator')) {
    navItems = adminNav;
    roleLabel = role.replace('_', ' ');
  } else if (hasRole('counselor')) {
    navItems = counselorNav;
    roleLabel = 'Counselor';
  } else if (hasRole('nurse')) {
    navItems = nurseNav;
    roleLabel = 'Nurse';
  } else if (hasRole('teacher', 'class_teacher')) {
    navItems = teacherNav;
    roleLabel = role.replace('_', ' ');
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40"
      style={{ background: T.bgDeep, borderRight: `1px solid ${T.border}` }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: T.accent }}>
          <GraduationCap size={14} color="white" />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: T.text }}>Academia</div>
          <div className="text-xs capitalize" style={{ color: T.textMuted }}>{roleLabel}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {isStudent ? (
          // Student nav with section labels
          <>
            {STUDENT_SECTIONS.map((section, sIdx) => {
              const items = navItems.slice(
                STUDENT_SECTIONS.slice(0, sIdx).reduce((a, s) => a + s.count, 0),
                STUDENT_SECTIONS.slice(0, sIdx).reduce((a, s) => a + s.count, 0) + section.count,
              );
              return (
                <div key={section.label} className={sIdx > 0 ? 'mt-4' : ''}>
                  <div className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: T.textMuted }}>
                    {section.label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map(item => <NavItem key={item.to} item={item} />)}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="space-y-0.5">
            {navItems.map(item => <NavItem key={item.to} item={item} />)}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="p-3" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: T.accent, color: '#fff' }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{user?.name}</div>
            <div className="text-xs truncate" style={{ color: T.textMuted }}>{user?.email}</div>
          </div>
          <button onClick={logout} className="p-1.5 rounded-md hover:bg-black/8" style={{ color: T.textMuted }} title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.to.split('/').length <= 2}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-100"
      style={({ isActive }) => isActive
        ? { background: T.accent, color: '#FFFFFF', fontWeight: 500 }
        : { color: T.textSub }}>
      {({ isActive }) => (
        <>
          <span className="shrink-0" style={{ opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}
