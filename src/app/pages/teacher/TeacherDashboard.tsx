import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Card, Empty, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Clock, AlertCircle, BookOpen } from 'lucide-react';

interface ClassToday {
  id: number; subject: string; subject_color: string; section: string;
  section_id: number; room?: string; start_time: string; end_time: string; period: number;
}
interface DashboardData {
  today_classes: ClassToday[];
  pending_corrections: number;
  recent_activity: { id: number; type: string; title?: string; section_id: number; created_at: string }[];
}

export function TeacherDashboard() {
  const { request } = useApi();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<DashboardData>('/teachers/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  if (loading) return <Layout title="Dashboard"><Skeleton /></Layout>;

  return (
    <Layout title="Dashboard">
      <div className="max-w-4xl space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Today's Classes", value: data?.today_classes.length ?? 0, icon: <Clock size={16} /> },
            { label: 'Pending Grades',  value: data?.pending_corrections ?? 0,  icon: <AlertCircle size={16} /> },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: T.bgDeep, color: T.accent }}>{s.icon}</div>
              <div>
                <div className="text-2xl font-bold" style={{ color: T.text }}>{s.value}</div>
                <div className="text-xs" style={{ color: T.textMuted }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} style={{ color: T.accent }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Today's Schedule</h2>
            </div>
            {!data?.today_classes.length ? <Empty icon={<Clock size={18} />} text="No classes today" /> : (
              <div className="space-y-2">
                {data.today_classes.map(c => (
                  <a key={c.id} href={`/teacher/attendance?section=${c.section_id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors"
                    style={{ background: T.bg }}>
                    <div className="w-0.5 h-9 rounded-full shrink-0" style={{ background: c.subject_color }} />
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ color: T.text }}>{c.subject}</div>
                      <div className="text-xs" style={{ color: T.textMuted }}>{c.section}{c.room && ` · ${c.room}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium" style={{ color: T.textSub }}>{c.start_time.slice(0,5)}</div>
                      <div className="text-xs" style={{ color: T.textMuted }}>P{c.period}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={14} style={{ color: T.accent }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {data?.recent_activity.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: T.bg }}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: a.type === 'assignment' ? T.warning : T.accent }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: T.text }}>{a.title ?? a.type}</div>
                    <div className="text-xs" style={{ color: T.textMuted }}>{new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded capitalize"
                    style={{ background: T.bgDeep, color: T.textMuted }}>{a.type}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
