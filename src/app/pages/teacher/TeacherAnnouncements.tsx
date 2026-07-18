import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Select, Label, Input, Textarea, Empty } from '../../components/erp/UI';
import { RenderText } from '../../components/erp/RenderText';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Bell, Plus, X, AlertTriangle, Globe, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Announcement {
  id: number; author: { name: string }; title: string; content: string;
  scope: string; priority: string; created_at: string;
}
interface Section { section_id: number; section_name: string; }

export function TeacherAnnouncements() {
  const { request } = useApi();
  const { hasRole } = useAuth();
  const canBroadcast = hasRole('coordinator','principal','tech_admin');
  const [list, setList] = useState<Announcement[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', scope: 'class_wide', section_id: '', priority: 'normal' });

  const load = () => request<Announcement[]>('/announcements/').then(setList).catch(console.error);
  useEffect(() => {
    load();
    request<Section[]>('/teachers/my-sections').then(setSections).catch(console.error);
  }, [request]);

  const create = async () => {
    await request('/announcements/', { method: 'POST', body: { ...form, section_id: form.section_id ? Number(form.section_id) : null } });
    setShowForm(false); setForm({ title: '', content: '', scope: 'class_wide', section_id: '', priority: 'normal' }); load();
  };

  return (
    <Layout title="Announcements">
      <div className="max-w-xl space-y-4">
        <div className="flex justify-end">
          <Btn onClick={() => setShowForm(!showForm)}><Plus size={13} /> New Announcement</Btn>
        </div>

        {showForm && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>New Announcement</h3>
              <button onClick={() => setShowForm(false)} style={{ color: T.textMuted }}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Scope</Label>
                <Select value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}>
                  <option value="class_wide">Class-wide</option>
                  {canBroadcast && <option value="school_wide">School-wide</option>}
                </Select>
              </div>
              {form.scope === 'class_wide' && (
                <div><Label>Section</Label>
                  <Select value={form.section_id} onChange={e => setForm(p => ({ ...p, section_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                  </Select>
                </div>
              )}
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Content</Label><Textarea rows={4} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: T.textSub }}>
                <input type="checkbox" checked={form.priority === 'urgent'}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.checked ? 'urgent' : 'normal' }))} />
                Mark as urgent
              </label>
              <div className="flex-1" />
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn onClick={create}>Post</Btn>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {list.map(ann => (
            <div key={ann.id} className="rounded-2xl p-5"
              style={{ background: T.card, border: `1px solid ${ann.priority === 'urgent' ? T.danger + '50' : T.border}` }}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-semibold" style={{ color: T.text }}>{ann.title}</h3>
                    {ann.priority === 'urgent' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: T.dangerBg, color: T.danger }}>
                        <AlertTriangle size={10} /> Urgent
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: T.bgDeep, color: T.textMuted }}>
                      {ann.scope === 'school_wide' ? <><Globe size={10} /> School</> : <><Users size={10} /> Class</>}
                    </span>
                  </div>
                  <RenderText text={ann.content} tag="p" className="text-xs mt-2" style={{ color: T.textSub }} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: T.textMuted }}>
                <span>{ann.author.name}</span><span>·</span>
                <span>{new Date(ann.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {!list.length && <Empty icon={<Bell size={18} />} text="No announcements" />}
        </div>
      </div>
    </Layout>
  );
}
