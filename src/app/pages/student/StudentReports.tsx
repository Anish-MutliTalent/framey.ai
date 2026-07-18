import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Award, TrendingUp, BookOpen, Star, AlertCircle, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

interface TermMarks {
  term_id: number; term_name: string;
  subjects: {
    subject: string; color: string; total_percentage: number;
    assessments: { name: string; obtained: number; max: number; percentage: number }[];
  }[];
}
interface StudentProfile {
  id: number; roll_number?: string; admission_number?: string;
  section: { id: number; name: string; class_: { name: string } };
  user: { name: string };
}

const GRADE_COLOR = (pct: number) =>
  pct >= 90 ? T.success : pct >= 75 ? T.info : pct >= 60 ? T.warning : T.danger;

const letterGrade = (pct: number) => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
};

const tooltipStyle = { backgroundColor: T.text, borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' };

export function StudentReports() {
  const { request } = useApi();
  const { user } = useAuth();
  const [marks, setMarks] = useState<TermMarks[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      request<TermMarks[]>('/students/marks'),
      request<StudentProfile>('/students/me'),
    ]).then(([m, p]) => {
      setMarks(m);
      setProfile(p);
      if (m.length) setSelectedTerm(m[0].term_id);
    }).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  const term = marks.find(t => t.term_id === selectedTerm);
  const overallPct = term
    ? Math.round(term.subjects.reduce((a, s) => a + s.total_percentage, 0) / Math.max(term.subjects.length, 1))
    : 0;

  // Chart data
  const barData = term?.subjects.map(s => ({ subject: s.subject.slice(0, 5), grade: Math.round(s.total_percentage), color: s.color })) ?? [];
  const radarData = term?.subjects.map(s => ({ subject: s.subject.slice(0, 5), A: Math.round(s.total_percentage), fullMark: 100 })) ?? [];

  if (loading) return <Layout title="Reports"><div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl" style={{ background: T.bgDeep }} />)}</div></Layout>;

  return (
    <Layout title="Report Card">
      <div className="max-w-5xl space-y-5">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {marks.map(t => (
              <button key={t.term_id} onClick={() => setSelectedTerm(t.term_id)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={selectedTerm === t.term_id
                  ? { background: T.accent, color: '#fff' }
                  : { background: T.bgDeep, color: T.textMuted, border: `1px solid ${T.border}` }}>
                {t.term_name}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ border: `1px solid ${T.border}`, color: T.textSub }}>
            <Download size={13} /> Download PDF
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Overall', value: `${overallPct}%`, icon: <Star size={16} />, color: T.warning },
            { label: 'Grade', value: letterGrade(overallPct), icon: <Award size={16} />, color: T.accent },
            { label: 'Subjects', value: term?.subjects.length ?? 0, icon: <BookOpen size={16} />, color: T.info },
            { label: 'Status', value: overallPct >= 40 ? 'Passing' : 'At Risk', icon: <TrendingUp size={16} />, color: overallPct >= 40 ? T.success : T.danger },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-4 flex items-start justify-between"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div>
                <p className="text-xs" style={{ color: T.textMuted }}>{stat.label}</p>
                <h3 className="text-2xl font-bold mt-1" style={{ color: T.text }}>{stat.value}</h3>
              </div>
              <div className="p-2 rounded-xl" style={{ background: `${stat.color}12`, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
          ))}
        </div>

        {term ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: charts + subject table */}
            <div className="lg:col-span-2 space-y-5">
              {/* Bar chart */}
              <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <h3 className="text-sm font-semibold mb-5" style={{ color: T.text }}>Academic Performance</h3>
                {barData.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
                        <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} dy={6} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: T.textMuted, fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: `${T.accent}10` }} />
                        <Bar dataKey="grade" fill={T.accent} radius={[5, 5, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-center py-10 text-xs" style={{ color: T.textMuted }}>No marks yet</p>}
              </div>

              {/* Subject breakdown table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <h3 className="text-sm font-semibold" style={{ color: T.text }}>Subject Breakdown</h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: T.bgDeep }}>
                      <th className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Subject</th>
                      <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Grade</th>
                      <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Percentage</th>
                      <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {term.subjects.map((s, idx) => {
                      const grade = letterGrade(s.total_percentage);
                      return (
                        <tr key={s.subject} style={{ borderBottom: `1px solid ${T.border}`, background: idx % 2 === 0 ? T.card : T.bg }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                              <span className="font-medium" style={{ color: T.text }}>{s.subject}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-lg font-bold text-xs"
                              style={{ background: `${GRADE_COLOR(s.total_percentage)}15`, color: GRADE_COLOR(s.total_percentage) }}>
                              {grade}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: GRADE_COLOR(s.total_percentage) }}>
                            {s.total_percentage}%
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs font-medium"
                              style={{ color: s.total_percentage >= 40 ? T.success : T.danger }}>
                              <TrendingUp size={11} />
                              {s.total_percentage >= 40 ? 'Passing' : 'Failing'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Radar + remarks */}
            <div className="space-y-5">
              {/* Radar chart */}
              {radarData.length >= 3 && (
                <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: T.text }}>Skills Assessment</h3>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke={T.border} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: T.textMuted, fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Student" dataKey="A" stroke={T.accent} strokeWidth={2} fill={T.accent} fillOpacity={0.15} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Overall grade card */}
              <div className="rounded-2xl p-5"
                style={{ background: `linear-gradient(135deg, ${T.bgDeep} 0%, ${T.card} 100%)`, border: `1px solid ${T.border}` }}>
                <div className="text-center">
                  <div className="text-5xl font-black mb-1" style={{ color: GRADE_COLOR(overallPct) }}>
                    {letterGrade(overallPct)}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>{overallPct}% Overall</div>
                  <div className="text-xs mt-1" style={{ color: T.textMuted }}>{term.term_name}</div>
                </div>
                <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: T.bgDeep }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${overallPct}%`, background: GRADE_COLOR(overallPct) }} />
                </div>
              </div>

              {/* Alert if failing */}
              {overallPct < 75 && (
                <div className="rounded-2xl p-4"
                  style={{ background: T.warningBg, border: `1px solid ${T.warning}40` }}>
                  <div className="flex gap-3">
                    <AlertCircle size={18} style={{ color: T.warning }} className="shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold mb-0.5" style={{ color: T.text }}>Attention Needed</h4>
                      <p className="text-xs" style={{ color: T.textSub }}>
                        Your overall is below 75%. Review weak subjects and seek teacher feedback.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="text-center py-16 text-sm" style={{ color: T.textMuted }}>
              No marks available yet for this term.
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
