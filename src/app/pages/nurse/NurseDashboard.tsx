import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Label, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, Activity, Stethoscope, Search, X } from 'lucide-react';

interface Student { id: number; name: string; roll_number?: string; section: string }
interface Visit {
  id: number; student_id: number; student_name: string; roll_number?: string; nurse_name: string;
  visited_at: string; reason: string; symptoms?: string | null; treatment?: string | null;
  notes?: string | null; sent_home: boolean; follow_up: boolean;
}

// ── Searchable student picker ────────────────────────────────────────────────
function StudentPicker({ students, value, onChange }: {
  students: Student[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = students.find(s => String(s.id) === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? students.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_number || '').toLowerCase().includes(q) ||
        (s.section || '').toLowerCase().includes(q))
    : students;

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: T.card, color: T.textSub }}>{selected.name?.[0] ?? '?'}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{selected.name}</p>
            <p className="text-xs truncate" style={{ color: T.textMuted }}>{selected.section}{selected.roll_number ? ` · ${selected.roll_number}` : ''}</p>
          </div>
          <button type="button" onClick={() => { onChange(''); setQuery(''); }}
            className="p-1 rounded-lg hover:opacity-70" style={{ color: T.textMuted }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3" style={{ color: T.textMuted }} />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search student by name, roll, or class…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}
          />
          {open && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              {filtered.length === 0 ? (
                <p className="text-xs px-3 py-3" style={{ color: T.textMuted }}>No students match.</p>
              ) : (
                filtered.slice(0, 50).map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { onChange(String(s.id)); setQuery(''); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                    style={{ borderTop: `1px solid ${T.border}` }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: T.bgDeep, color: T.textSub }}>{s.name?.[0] ?? '?'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: T.text }}>{s.name}</p>
                      <p className="text-xs truncate" style={{ color: T.textMuted }}>{s.section}{s.roll_number ? ` · ${s.roll_number}` : ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NurseDashboard() {
  const { request } = useApi();
  const [students, setStudents] = useState<Student[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const empty = { student_id: '', reason: '', symptoms: '', treatment: '', notes: '', sent_home: false, follow_up: false };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [st, vs] = await Promise.all([
        request<Student[]>('/nurse/students'),
        request<Visit[]>('/nurse/visits'),
      ]);
      setStudents(st);
      setVisits(vs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.student_id || !form.reason.trim()) { alert('Pick a student and enter a reason.'); return; }
    setSaving(true);
    try {
      await request('/nurse/visits', {
        method: 'POST',
        body: {
          student_id: Number(form.student_id),
          reason: form.reason.trim(),
          symptoms: form.symptoms || null,
          treatment: form.treatment || null,
          notes: form.notes || null,
          sent_home: form.sent_home,
          follow_up: form.follow_up,
        },
      });
      setForm(empty);
      setShowForm(false);
      const vs = await request<Visit[]>('/nurse/visits');
      setVisits(vs);
    } finally { setSaving(false); }
  };

  return (
    <Layout title="Infirmary">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: T.success + '14' }}>
              <Stethoscope size={20} style={{ color: T.success }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: T.text }}>Infirmary</h1>
              <p className="text-xs" style={{ color: T.textMuted }}>Log student visits to the infirmary. Records are visible in each student's wellness section.</p>
            </div>
          </div>
          <Btn onClick={() => setShowForm(s => !s)}><Plus size={13} /> Log visit</Btn>
        </div>

        {showForm && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Student</Label>
                <StudentPicker students={students} value={form.student_id} onChange={id => setForm(p => ({ ...p, student_id: id }))} />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Headache, Fever, Injury" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Symptoms</Label>
                <Input value={form.symptoms} onChange={e => setForm(p => ({ ...p, symptoms: e.target.value }))}
                  placeholder="Optional" />
              </div>
              <div>
                <Label>Treatment</Label>
                <Input value={form.treatment} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))}
                  placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs" style={{ color: T.textSub }}>
                <input type="checkbox" checked={form.sent_home} onChange={e => setForm(p => ({ ...p, sent_home: e.target.checked }))} />
                Sent home
              </label>
              <label className="flex items-center gap-2 text-xs" style={{ color: T.textSub }}>
                <input type="checkbox" checked={form.follow_up} onChange={e => setForm(p => ({ ...p, follow_up: e.target.checked }))} />
                Needs follow-up
              </label>
            </div>
            <div className="flex gap-2">
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save visit'}</Btn>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setForm(empty); }}>Cancel</Btn>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: T.bgDeep, borderBottom: `1px solid ${T.border}` }}>
            <Activity size={14} style={{ color: T.textMuted }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Recent visits</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-xs" style={{ color: T.textMuted }}>Loading…</div>
          ) : visits.length === 0 ? (
            <Empty text="No infirmary visits logged yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: T.bgDeep, color: T.textMuted }}>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Treatment</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">When</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider">Flags</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id} style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ color: T.text }}>{v.student_name}</p>
                      {v.roll_number && <p className="text-xs" style={{ color: T.textMuted }}>Roll {v.roll_number}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: T.text }}>{v.reason}</span></td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: T.textSub }}>{v.treatment || '—'}</span></td>
                    <td className="px-4 py-3"><span className="text-xs" style={{ color: T.textMuted }}>
                      {new Date(v.visited_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {v.sent_home && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: T.warningBg, color: T.warning }}>Sent home</span>}
                        {v.follow_up && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: T.dangerBg, color: T.danger }}>Follow-up</span>}
                      </div>
                    </td>
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
