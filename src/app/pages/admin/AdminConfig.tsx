import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Save, Plus } from 'lucide-react';

interface School { id: number; name: string; grading_system: string; address?: string; phone?: string; email?: string; }
interface Term { id: number; name: string; start_date: string; end_date: string; }
interface AcademicYear { id: number; name: string; start_date: string; end_date: string; is_current: boolean; terms: Term[]; }

export function AdminConfig() {
  const { request } = useApi();
  const [school, setSchool] = useState<School | null>(null);
  const [years, setYears]   = useState<AcademicYear[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [newYear, setNewYear] = useState({ name: '', start_date: '', end_date: '', is_current: false });
  const [newTerm, setNewTerm] = useState<{ year_id: number; name: string; start_date: string; end_date: string } | null>(null);

  const load = async () => {
    const [s, y] = await Promise.all([request<School>('/admin/school'), request<AcademicYear[]>('/admin/academic-years')]);
    setSchool(s); setYears(y);
  };
  useEffect(() => { load().catch(console.error); }, [request]);

  const saveSchool = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await request('/admin/school', { method: 'PUT', body: { name: school.name, grading_system: school.grading_system, address: school.address, phone: school.phone, email: school.email } });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const addYear = async () => {
    await request('/admin/academic-years', { method: 'POST', body: newYear });
    setNewYear({ name: '', start_date: '', end_date: '', is_current: false }); load().catch(console.error);
  };
  const addTerm = async () => {
    if (!newTerm) return;
    await request(`/admin/academic-years/${newTerm.year_id}/terms`, { method: 'POST', body: { name: newTerm.name, start_date: newTerm.start_date, end_date: newTerm.end_date } });
    setNewTerm(null); load().catch(console.error);
  };

  const field = (key: keyof School) => (
    <div>
      <Label>{key.charAt(0).toUpperCase() + key.slice(1)}</Label>
      <Input value={(school as Record<string, string> | null)?.[key as string] ?? ''}
        onChange={e => setSchool(p => p ? { ...p, [key]: e.target.value } : null)} />
    </div>
  );

  return (
    <Layout title="School Configuration">
      <div className="max-w-xl space-y-6">
        {/* School card */}
        {school && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>School Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {field('name')} {field('email')} {field('phone')} {field('address')}
            </div>
            <div>
              <Label>Grading System</Label>
              <Select value={school.grading_system} onChange={e => setSchool(p => p ? { ...p, grading_system: e.target.value } : null)}>
                <option value="percentage">Percentage (%)</option>
                <option value="gpa">GPA (4.0 scale)</option>
                <option value="cbse">CBSE (A1–E)</option>
              </Select>
            </div>
            <Btn onClick={saveSchool} disabled={saving}
              style={{ background: saved ? T.success : T.accent, color: '#fff' }}>
              <Save size={13} />{saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </Btn>
          </div>
        )}

        {/* Academic years */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Academic Years</h3>
          <div className="grid grid-cols-4 gap-2">
            <Input placeholder="2024-25" value={newYear.name} onChange={e => setNewYear(p => ({ ...p, name: e.target.value }))} />
            <Input type="date" value={newYear.start_date} onChange={e => setNewYear(p => ({ ...p, start_date: e.target.value }))} />
            <Input type="date" value={newYear.end_date} onChange={e => setNewYear(p => ({ ...p, end_date: e.target.value }))} />
            <Btn onClick={addYear}><Plus size={12} /> Add</Btn>
          </div>

          {years.map(yr => (
            <div key={yr.id} className="rounded-xl p-4 space-y-3"
              style={{ background: T.bg, border: `1px solid ${yr.is_current ? T.accent + '50' : T.border}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: T.text }}>{yr.name}</span>
                {yr.is_current && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: T.accentBg, color: T.accent }}>Current</span>
                )}
                <span className="ml-auto text-xs" style={{ color: T.textMuted }}>{yr.start_date} → {yr.end_date}</span>
              </div>
              <div className="space-y-1">
                {yr.terms.map(t => (
                  <div key={t.id} className="flex items-center gap-3 text-xs" style={{ color: T.textSub }}>
                    <span className="font-medium">{t.name}</span>
                    <span style={{ color: T.textMuted }}>{t.start_date} → {t.end_date}</span>
                  </div>
                ))}
                {newTerm?.year_id === yr.id ? (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Term 1" value={newTerm.name} onChange={e => setNewTerm(p => p ? { ...p, name: e.target.value } : null)} className="flex-1" />
                    <Input type="date" value={newTerm.start_date} onChange={e => setNewTerm(p => p ? { ...p, start_date: e.target.value } : null)} className="w-32" />
                    <Input type="date" value={newTerm.end_date} onChange={e => setNewTerm(p => p ? { ...p, end_date: e.target.value } : null)} className="w-32" />
                    <Btn onClick={addTerm}>Add</Btn>
                    <Btn variant="ghost" onClick={() => setNewTerm(null)}>✕</Btn>
                  </div>
                ) : (
                  <button onClick={() => setNewTerm({ year_id: yr.id, name: '', start_date: '', end_date: '' })}
                    className="flex items-center gap-1 text-xs mt-1 hover:opacity-80"
                    style={{ color: T.textMuted }}>
                    <Plus size={11} /> Add Term
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
