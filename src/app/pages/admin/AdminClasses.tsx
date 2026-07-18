import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface Section { id: number; name: string; class_teacher_id?: number; }
interface Class { id: number; name: string; level: number; sections: Section[]; }
interface User { id: number; name: string; }

export function AdminClasses() {
  const { request } = useApi();
  const [classes, setClasses] = useState<Class[]>([]);
  const [users, setUsers]     = useState<User[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newClass, setNewClass] = useState({ name: '', level: '' });
  const [newSection, setNewSection] = useState<{ class_id: number; name: string } | null>(null);

  const load = () => Promise.all([
    request<Class[]>('/admin/classes'),
    request<User[]>('/admin/users'),
  ]).then(([c, u]) => { setClasses(c); setUsers(u); }).catch(console.error);

  useEffect(() => { load(); }, [request]);

  const addClass = async () => {
    await request('/admin/classes', { method: 'POST', body: { name: newClass.name, level: Number(newClass.level) } });
    setNewClass({ name: '', level: '' }); load();
  };
  const addSection = async () => {
    if (!newSection) return;
    await request('/admin/sections', { method: 'POST', body: newSection });
    setNewSection(null); load();
  };
  const assignCT = async (sectionId: number, teacherId: number) => {
    await request(`/admin/sections/${sectionId}/class-teacher?teacher_id=${teacherId}`, { method: 'PUT' }); load();
  };

  const toggle = (id: number) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Layout title="Classes & Sections">
      <div className="max-w-2xl space-y-5">
        {/* Add class */}
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>New Class</h3>
          <div className="flex gap-3">
            <div className="flex-1"><Input placeholder="Grade 10" value={newClass.name} onChange={e => setNewClass(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="w-24"><Input placeholder="Level" type="number" value={newClass.level} onChange={e => setNewClass(p => ({ ...p, level: e.target.value }))} /></div>
            <Btn onClick={addClass}><Plus size={13} /> Add</Btn>
          </div>
        </div>

        {/* Classes */}
        <div className="space-y-2">
          {classes.map(cls => (
            <div key={cls.id} className="rounded-2xl overflow-hidden"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <button onClick={() => toggle(cls.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-stone-50 transition-colors">
                {expanded.has(cls.id) ? <ChevronDown size={14} style={{ color: T.textMuted }} /> : <ChevronRight size={14} style={{ color: T.textMuted }} />}
                <span className="text-sm font-semibold" style={{ color: T.text }}>{cls.name}</span>
                <span className="ml-auto text-xs" style={{ color: T.textMuted }}>Level {cls.level} · {cls.sections.length} sections</span>
              </button>

              {expanded.has(cls.id) && (
                <div style={{ borderTop: `1px solid ${T.border}` }}>
                  {cls.sections.map(sec => (
                    <div key={sec.id} className="flex items-center gap-4 px-5 py-3"
                      style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span className="text-xs font-medium" style={{ color: T.text }}>{cls.name} – {sec.name}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs" style={{ color: T.textMuted }}>Class Teacher:</span>
                        <select value={sec.class_teacher_id ?? ''} onChange={e => assignCT(sec.id, Number(e.target.value))}
                          className="px-2 py-1.5 rounded-lg text-xs outline-none appearance-none"
                          style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: T.text }}>
                          <option value="">— Unassigned</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}

                  {newSection?.class_id === cls.id ? (
                    <div className="flex gap-2 p-4">
                      <Input placeholder="Section (A, B…)" value={newSection.name}
                        onChange={e => setNewSection(p => p ? { ...p, name: e.target.value } : null)} />
                      <Btn onClick={addSection}>Add</Btn>
                      <Btn variant="ghost" onClick={() => setNewSection(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <button onClick={() => setNewSection({ class_id: cls.id, name: '' })}
                      className="flex items-center gap-1.5 w-full px-5 py-3 text-xs hover:bg-stone-50 transition-colors"
                      style={{ color: T.textMuted }}>
                      <Plus size={12} /> Add Section
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
