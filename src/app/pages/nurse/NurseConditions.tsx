import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Activity, Search } from 'lucide-react';

interface Condition {
  id: number; student_id: number; student_name: string; roll_number?: string;
  section?: string | null; condition: string; notes?: string | null; created_at: string;
}

export function NurseConditions() {
  const { request } = useApi();
  const [items, setItems] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    request<Condition[]>('/wellness/conditions')
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(c =>
      (c.student_name || '').toLowerCase().includes(q) ||
      (c.condition || '').toLowerCase().includes(q) ||
      (c.section || '').toLowerCase().includes(q) ||
      (c.roll_number || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Layout title="Medical Conditions">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: T.warning + '14' }}>
            <Activity size={20} style={{ color: T.warning }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: T.text }}>Medical Conditions</h1>
            <p className="text-xs" style={{ color: T.textMuted }}>All medical conditions listed by students across the school.</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-2.5" style={{ color: T.textMuted }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by student, condition, class, or notes…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {loading ? (
            <div className="p-8 text-center text-xs" style={{ color: T.textMuted }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <Empty text={query ? "No conditions match your search." : "No medical conditions listed by students."} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: T.bgDeep, color: T.textMuted }}>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Section</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Condition</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ color: T.text }}>{c.student_name}</p>
                      {c.roll_number && <p className="text-xs" style={{ color: T.textMuted }}>Roll {c.roll_number}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: T.textSub }}>{c.section || '—'}</span></td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: T.warningBg, color: T.warning }}>{c.condition}</span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: T.textSub }}>{c.notes || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
