import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Select, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { BarChart2, TrendingUp, Zap } from 'lucide-react';

interface Term { id: number; name: string; }
interface GradeDist { grade: string; count: number; }
interface Overview { average_percentage: number; total_students: number; grade_distribution: GradeDist[]; }

export function AdminReports() {
  const { request } = useApi();
  const [terms, setTerms]             = useState<Term[]>([]);
  const [sections, setSections]       = useState<{ id: number; name: string }[]>([]);
  const [selectedTerm, setTerm]       = useState<number | null>(null);
  const [selectedSection, setSection] = useState<number | null>(null);
  const [overview, setOverview]       = useState<Overview | null>(null);
  const [generating, setGenerating]   = useState(false);

  useEffect(() => {
    Promise.all([
      request<{ is_current: boolean; terms: Term[] }[]>('/admin/academic-years'),
      request<{ sections: { id: number; name: string }[] }[]>('/admin/classes'),
    ]).then(([years, cls]) => {
      const cur = years.find(y => y.is_current) ?? years[0];
      if (cur) { setTerms(cur.terms); if (cur.terms.length) setTerm(cur.terms[0].id); }
      const secs = cls.flatMap((c: { sections: { id: number; name: string }[] }) => c.sections ?? []);
      setSections(secs as { id: number; name: string }[]);
      if (secs.length) setSection((secs[0] as { id: number }).id);
    }).catch(console.error);
  }, [request]);

  useEffect(() => {
    if (!selectedTerm) return;
    request<Overview>(`/reports/school-overview?term_id=${selectedTerm}`).then(setOverview).catch(console.error);
  }, [selectedTerm, request]);

  const generate = async () => {
    if (!selectedSection || !selectedTerm) return;
    setGenerating(true);
    try {
      await request(`/reports/generate/${selectedSection}/${selectedTerm}`, { method: 'POST' });
      const u = await request<Overview>(`/reports/school-overview?term_id=${selectedTerm}`);
      setOverview(u);
    } finally { setGenerating(false); }
  };

  const maxCount = Math.max(...(overview?.grade_distribution.map(g => g.count) ?? [1]));

  return (
    <Layout title="School Reports">
      <div className="max-w-4xl space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedTerm ?? ''} onChange={e => setTerm(Number(e.target.value))} className="w-auto">
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={selectedSection ?? ''} onChange={e => setSection(Number(e.target.value))} className="w-auto">
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Btn onClick={generate} disabled={generating} className="ml-auto">
            <Zap size={13} />{generating ? 'Generating…' : 'Generate Reports'}
          </Btn>
        </div>

        {overview && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'School Average', value: `${overview.average_percentage}%`, icon: <TrendingUp size={16} /> },
                { label: 'Total Students', value: overview.total_students, icon: <BarChart2 size={16} /> },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-5 flex items-center gap-4"
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

            <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: T.textMuted }}>Grade Distribution</h3>
              {overview.grade_distribution.length === 0 ? (
                <Empty icon={<BarChart2 size={18} />} text="No data — generate reports first" />
              ) : (
                <div className="flex items-end gap-4 h-40">
                  {overview.grade_distribution.map(g => (
                    <div key={g.grade} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-xs font-semibold" style={{ color: T.text }}>{g.count}</span>
                      <div className="w-full rounded-t-lg"
                        style={{ background: T.accent, height: `${Math.max((g.count / maxCount) * 100, 4)}px`, opacity: 0.5 + (g.count / maxCount) * 0.5 }} />
                      <span className="text-xs font-medium" style={{ color: T.accent }}>{g.grade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
