import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Label, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T, SUBJECT_COLORS } from '../../theme';
import { Plus, Trash2 } from 'lucide-react';

interface Subject { id: number; name: string; code?: string; color: string; }

export function AdminSubjects() {
  const { request } = useApi();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ name: '', code: '', color: SUBJECT_COLORS[0] });

  const load = () => request<Subject[]>('/admin/subjects').then(setSubjects).catch(console.error);
  useEffect(() => { load(); }, [request]);

  const add = async () => {
    await request('/admin/subjects', { method: 'POST', body: form });
    setForm({ name: '', code: '', color: SUBJECT_COLORS[0] }); load();
  };
  const del = async (id: number) => {
    if (!confirm('Delete this subject?')) return;
    await request(`/admin/subjects/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <Layout title="Subjects">
      <div className="max-w-xl space-y-5">
        {/* Add form */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Add Subject</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mathematics" /></div>
            <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="MATH" /></div>
          </div>
          <div>
            <Label>Colour</Label>
            <div className="flex gap-2 mt-1">
              {SUBJECT_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 shrink-0"
                  style={{ background: c, outline: form.color === c ? `2px solid ${T.accent}` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
          <Btn onClick={add}><Plus size={13} /> Add Subject</Btn>
        </div>

        {/* List */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {subjects.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3"
              style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1">
                <span className="text-xs font-semibold" style={{ color: T.text }}>{s.name}</span>
                {s.code && <span className="text-xs ml-2" style={{ color: T.textMuted }}>{s.code}</span>}
              </div>
              <button onClick={() => del(s.id)}
                className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: T.textMuted }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!subjects.length && <Empty text="No subjects yet" />}
        </div>
      </div>
    </Layout>
  );
}
