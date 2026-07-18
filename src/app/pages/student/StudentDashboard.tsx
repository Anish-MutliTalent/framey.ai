import { useEffect, useState, ReactNode } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Clock, BookOpen, Bell, CheckCircle2, AlertCircle, Calendar, TrendingUp } from 'lucide-react';

interface TimetableEntry {
  id: number; subject: string; subject_color: string; teacher: string;
  room?: string; start_time: string; end_time: string; period: number;
}
interface Assignment {
  id: number; title: string; subject?: string; due_date?: string; submitted: boolean;
}
interface Announcement {
  id: number; title: string; content: string; priority: string; scope: string; created_at: string;
}
interface DashboardData {
  timetable: TimetableEntry[];
  upcoming_assignments: Assignment[];
  announcements: Announcement[];
  attendance: { total_classes: number; present: number; percentage: number };
}

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl p-5 ${className}`}
    style={{ background: T.card, border: `1px solid ${T.border}` }}>
    {children}
  </div>
);

const SectionHeader = ({ icon, label, aside }: { icon: ReactNode; label: string; aside?: ReactNode }) => (
  <div className="flex items-center gap-2 mb-4">
    <span style={{ color: T.accent }}>{icon}</span>
    <h2 className="text-sm font-semibold" style={{ color: T.text }}>{label}</h2>
    {aside && <span className="ml-auto text-xs" style={{ color: T.textMuted }}>{aside}</span>}
  </div>
);

export function StudentDashboard() {
  const { request } = useApi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<DashboardData>('/students/dashboard')
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  if (loading) return <Layout title="Dashboard"><Skeleton /></Layout>;

  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const pct = data?.attendance.percentage ?? 0;

  return (
    <Layout title="Dashboard">
      <div className="space-y-5 max-w-5xl">
        {/* Date bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: T.textMuted }}>
            {days[now.getDay()]}, {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: pct >= 75 ? T.successBg : T.dangerBg, color: pct >= 75 ? T.success : T.danger }}>
            <TrendingUp size={12} />
            Attendance {pct}%
          </div>
        </div>

        {/* 1 — Upcoming Assignments */}
        <Card>
          <SectionHeader icon={<BookOpen size={15} />} label="Upcoming Assignments" />
          {!data?.upcoming_assignments.length ? (
            <Empty icon={<CheckCircle2 size={18} />} text="All caught up!" />
          ) : (
            <div className="space-y-2">
              {data.upcoming_assignments.map(a => {
                const due = a.due_date ? new Date(a.due_date) : null;
                const overdue = due && due < now;
                return (
                  <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
                    style={{ background: T.bg }}>
                    {a.submitted
                      ? <CheckCircle2 size={14} className="shrink-0" style={{ color: T.success }} />
                      : <AlertCircle size={14} className="shrink-0" style={{ color: overdue ? T.danger : T.warning }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: T.text }}>{a.title}</div>
                      <div className="text-xs" style={{ color: T.textMuted }}>{a.subject}</div>
                    </div>
                    {due && (
                      <span className="text-xs shrink-0" style={{ color: overdue ? T.danger : T.textMuted }}>
                        {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 2 — Announcements */}
        <Card>
          <SectionHeader icon={<Bell size={15} />} label="Announcements" />
          {!data?.announcements.length ? (
            <Empty icon={<Bell size={18} />} text="No announcements" />
          ) : (
            <div className="divide-y" style={{ borderColor: T.border }}>
              {data.announcements.map(ann => (
                <div key={ann.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: ann.priority === 'urgent' ? T.danger : T.accent }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: T.text }}>{ann.title}</span>
                      {ann.priority === 'urgent' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: T.dangerBg, color: T.danger }}>Urgent</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: T.textSub }}>{ann.content}</p>
                    <span className="text-xs" style={{ color: T.textMuted }}>
                      {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 3 — Quick links (no Timetable — it has its own nav item) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Classroom', href: '/student/classroom', icon: <BookOpen size={16} /> },
            { label: 'Calendar',  href: '/student/calendar',  icon: <Calendar size={16} /> },
            { label: 'Reports',   href: '/student/reports',   icon: <TrendingUp size={16} /> },
          ].map(l => (
            <a key={l.label} href={l.href}
              className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium transition-all hover:bg-stone-100"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
              <span style={{ color: T.accent }}>{l.icon}</span>
              {l.label}
            </a>
          ))}
        </div>

        {/* 4 — Attendance summary (bottom) */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader icon={<TrendingUp size={15} />} label="Attendance Overview" aside={<span className="text-xs" style={{ color: T.textMuted }}>This Year</span>} />
          </div>
          <div className="flex items-end gap-4 mb-3">
            <div className="text-3xl font-bold" style={{ color: pct >= 75 ? T.success : T.danger }}>{pct}%</div>
            <div className="text-xs mb-1" style={{ color: T.textMuted }}>
              {data?.attendance.present} / {data?.attendance.total_classes} days present
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: T.bgDeep }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 75 ? T.success : T.danger }} />
          </div>
          {pct < 75 && (
            <p className="text-xs mt-2" style={{ color: T.danger }}>
              Below 75% minimum — attendance needs improvement.
            </p>
          )}
        </Card>
      </div>
    </Layout>
  );
}

function Skeleton() {
  return <div className="space-y-4 animate-pulse">{[1,2,3].map(i => (
    <div key={i} className="h-32 rounded-2xl" style={{ background: T.card }} />
  ))}</div>;
}
function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex flex-col items-center py-8 gap-2" style={{ color: T.textMuted }}>
    {icon}<span className="text-xs">{text}</span>
  </div>;
}
