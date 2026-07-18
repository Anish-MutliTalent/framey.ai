import { useState, useEffect } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { TrendingUp, Clock, Target, BookOpen, Plus, X } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Log { id: number; activity: string; subject: string; duration_minutes: number; mastery_score: number | null; created_at: string; }

export function StudentProgress() {
  const { request } = useApi();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ activity: '', subject: '', duration_minutes: 30, mastery_score: 0 });

  useEffect(() => {
    request<Log[]>('/progress').then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  const logActivity = async () => {
    if (!form.activity.trim()) return;
    const log = await request<Log>('/progress', { method: 'POST', body: form });
    setLogs(prev => [log, ...prev]);
    setShowModal(false);
    setForm({ activity: '', subject: '', duration_minutes: 30, mastery_score: 0 });
  };

  const totalHours = Math.round(logs.reduce((a, l) => a + l.duration_minutes, 0) / 60 * 10) / 10;
  const withMastery = logs.filter(l => l.mastery_score != null);
  const avgMastery = withMastery.length ? Math.round(withMastery.reduce((a, l) => a + (l.mastery_score ?? 0), 0) / withMastery.length) : 0;

  // Last 7 days
  const byDate: Record<string, { minutes: number; mastery: number[] }> = {};
  logs.forEach(l => {
    const d = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!byDate[d]) byDate[d] = { minutes: 0, mastery: [] };
    byDate[d].minutes += l.duration_minutes;
    if (l.mastery_score) byDate[d].mastery.push(l.mastery_score);
  });
  const studyData = Object.entries(byDate).slice(-7).map(([name, d]) => ({
    name,
    hours: Math.round(d.minutes / 60 * 10) / 10,
    mastery: d.mastery.length ? Math.round(d.mastery.reduce((a, b) => a + b) / d.mastery.length) : 0,
  }));

  const bySubject: Record<string, number[]> = {};
  logs.forEach(l => { if (l.subject && l.mastery_score) { (bySubject[l.subject] ??= []).push(l.mastery_score); } });
  const masteryData = Object.entries(bySubject).map(([name, scores]) => ({
    name, mastery: Math.round(scores.reduce((a, b) => a + b) / scores.length),
  }));

  const tooltipStyle = {
    backgroundColor: T.text,
    borderRadius: '10px',
    border: 'none',
    color: '#fff',
    fontSize: '12px',
  };

  const InputField = ({ label, value, onChange, type = 'text', ...rest }: {
    label: string; value: string | number; onChange: (v: string) => void;
    type?: string; placeholder?: string; min?: string; max?: string;
  }) => (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} {...rest}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
    </div>
  );

  return (
    <Layout title="Learning Progress">
      <div className="max-w-5xl space-y-6">
        {/* Header actions */}
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: T.accent, color: '#fff' }}>
            <Plus size={14} /> Log Activity
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Hours',  value: totalHours,             icon: <Clock size={18} />,     color: T.info },
            { label: 'Sessions',     value: logs.length,            icon: <BookOpen size={18} />,  color: T.success },
            { label: 'Avg Mastery',  value: `${avgMastery}%`,       icon: <Target size={18} />,    color: '#7C3AED' },
            { label: 'Streak',       value: `${Math.min(logs.length, 7)} days`, icon: <TrendingUp size={18} />, color: T.warning },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-5"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: T.textMuted }}>{stat.label}</span>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: T.text }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="text-sm font-semibold mb-5" style={{ color: T.text }}>Study Hours (last 7 days)</h3>
            {studyData.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={studyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="hours" stroke={T.info} strokeWidth={2.5} dot={{ strokeWidth: 2, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex items-center justify-center h-56 text-xs" style={{ color: T.textMuted }}>Log activities to see the chart</div>}
          </div>

          <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="text-sm font-semibold mb-5" style={{ color: T.text }}>Topic Mastery</h3>
            {masteryData.length > 0 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={masteryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="mastery" fill="#7C3AED" radius={[5, 5, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex items-center justify-center h-56 text-xs" style={{ color: T.textMuted }}>Log activities with mastery scores</div>}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: T.text }}>Recent Activity</h3>
          {logs.length === 0 ? (
            <p className="text-center py-8 text-xs" style={{ color: T.textMuted }}>
              No activities yet. Click "Log Activity" to get started!
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: T.border }}>
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background: T.bgDeep }}>
                      <BookOpen size={14} style={{ color: T.accent }} />
                    </div>
                    <div>
                      <div className="text-xs font-medium" style={{ color: T.text }}>{log.activity}</div>
                      <div className="text-xs" style={{ color: T.textMuted }}>
                        {log.subject || 'General'} · {new Date(log.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium" style={{ color: T.text }}>{log.duration_minutes} min</div>
                    {log.mastery_score != null && (
                      <div className="text-xs" style={{ color: T.textMuted }}>Mastery: {log.mastery_score}%</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log modal */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: T.text }}>Log Study Activity</h3>
                <button onClick={() => setShowModal(false)} style={{ color: T.textMuted }}><X size={16} /></button>
              </div>
              <InputField label="What did you study?" value={form.activity}
                onChange={v => setForm(p => ({ ...p, activity: v }))} placeholder="e.g. Chapter 3 revision" />
              <InputField label="Subject" value={form.subject}
                onChange={v => setForm(p => ({ ...p, subject: v }))} placeholder="Math, Science…" />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Duration (minutes)" value={form.duration_minutes} type="number"
                  onChange={v => setForm(p => ({ ...p, duration_minutes: parseInt(v) || 0 }))} />
                <InputField label="Mastery (0–100)" value={form.mastery_score} type="number" min="0" max="100"
                  onChange={v => setForm(p => ({ ...p, mastery_score: parseInt(v) || 0 }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs" style={{ color: T.textMuted }}>Cancel</button>
                <button onClick={logActivity} disabled={!form.activity.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-medium disabled:opacity-40"
                  style={{ background: T.accent, color: '#fff' }}>
                  Log Activity
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
