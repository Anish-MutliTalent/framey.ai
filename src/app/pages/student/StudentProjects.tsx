import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, Presentation, Calendar, MoreVertical, Sparkles, Trash2, X, Loader, FolderOpen } from 'lucide-react';

interface Project { id: number; title: string; description: string; subject: string; status: string; updated_at: string | null; }

// ── Defined outside component so refs stay stable across re-renders ───────────
function Field({ label, value, onChange, placeholder = '', textarea = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />}
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'In Progress': { bg: T.accentBg, color: T.accent },
  'Review':      { bg: T.warningBg, color: T.warning },
  'Final':       { bg: T.bgDeep, color: T.textSub },
  'Completed':   { bg: T.successBg, color: T.success },
};

const timeAgo = (s: string | null) => {
  if (!s) return 'Just now';
  const h = Math.floor((Date.now() - new Date(s).getTime()) / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
};

export function StudentProjects() {
  const { request } = useApi();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [brainstormId, setBrainstormId] = useState<number | null>(null);
  const [bPrompt, setBPrompt] = useState('');
  const [bResult, setBResult] = useState('');
  const [bLoading, setBLoading] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', description: '' });

  useEffect(() => {
    request<Project[]>('/projects').then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  const create = async () => {
    if (!form.title.trim()) return;
    const p = await request<Project>('/projects', { method: 'POST', body: form });
    setProjects(prev => [p, ...prev]);
    setShowNew(false);
    setForm({ title: '', subject: '', description: '' });
  };

  const del = async (id: number) => {
    await request(`/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
    setMenu(null);
  };

  const brainstorm = async () => {
    if (!bPrompt.trim() || !brainstormId) return;
    setBLoading(true);
    try {
      const d = await request<{ response: string }>(`/projects/${brainstormId}/brainstorm`, {
        method: 'POST', body: { prompt: bPrompt },
      });
      setBResult(d.response);
    } catch {
      setBResult('Failed to connect to AI. Make sure ANTHROPIC_API_KEY is configured.');
    } finally { setBLoading(false); }
  };

  return (
    <Layout title="Projects">
      <div className="max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex justify-end">
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: T.accent, color: '#fff' }}>
            <Plus size={14} /> New Project
          </button>
        </div>

        {/* Grid */}
        {loading && <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl" style={{ background: T.bgDeep }} />)}
        </div>}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: T.textMuted }}>
            <Presentation size={32} strokeWidth={1.5} />
            <p className="text-sm">No projects yet. Create your first one!</p>
            <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-xl text-xs font-medium"
              style={{ background: T.accent, color: '#fff' }}>Create Project</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const st = STATUS_STYLES[p.status] ?? STATUS_STYLES['In Progress'];
            return (
              <div key={p.id}
                onDoubleClick={() => navigate(`/student/projects/${p.id}`)}
                className="group flex flex-col justify-between p-5 rounded-2xl min-h-[200px] relative cursor-pointer"
                style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-xl" style={{ background: st.bg }}>
                    <Presentation size={18} style={{ color: st.color }} />
                  </div>
                  <div className="relative">
                    <button onClick={() => setMenu(menu === p.id ? null : p.id)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-stone-100"
                      style={{ color: T.textMuted }}>
                      <MoreVertical size={16} />
                    </button>
                    {menu === p.id && (
                      <div className="absolute right-0 top-8 rounded-xl shadow-lg py-1 z-10 w-36"
                        style={{ background: T.card, border: `1px solid ${T.border}` }}>
                        <button onClick={() => { setBrainstormId(p.id); setMenu(null); }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-stone-50"
                          style={{ color: T.text }}>
                          <Sparkles size={12} /> AI Brainstorm
                        </button>
                        <button onClick={() => del(p.id)}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-red-50"
                          style={{ color: T.danger }}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className="text-sm font-semibold leading-snug" style={{ color: T.text }}>{p.title}</h3>
                  <p className="text-xs" style={{ color: T.textMuted }}>{p.subject || 'No subject'}</p>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between"
                  style={{ borderTop: `1px solid ${T.border}` }}>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: st.bg, color: st.color }}>
                    {p.status}
                  </span>
                  <button
                    onClick={() => navigate(`/student/projects/${p.id}`)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: T.accentBg, color: T.accent }}>
                    <FolderOpen size={12} /> Open
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* New project modal */}
        {showNew && (
          <Modal onClose={() => setShowNew(false)} title="New Project">
            <div className="space-y-3">
              <Field label="Project Title" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="My Science Project" />
              <Field label="Subject" value={form.subject} onChange={v => setForm(p => ({ ...p, subject: v }))} placeholder="Physics, Art…" />
              <Field label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="What's it about?" textarea />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNew(false)} className="px-3 py-2 text-xs" style={{ color: T.textMuted }}>Cancel</button>
                <button onClick={create} disabled={!form.title.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-medium disabled:opacity-40"
                  style={{ background: T.accent, color: '#fff' }}>Create</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Brainstorm modal */}
        {brainstormId !== null && (
          <Modal onClose={() => { setBrainstormId(null); setBResult(''); setBPrompt(''); }} title="AI Brainstorm">
            <div className="space-y-3">
              <textarea value={bPrompt} onChange={e => setBPrompt(e.target.value)} rows={3} placeholder="What do you need help with? e.g. 'Suggest an outline for my presentation'" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              <button onClick={brainstorm} disabled={bLoading || !bPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                {bLoading ? <><Loader size={13} className="animate-spin" /> Brainstorming…</> : <><Sparkles size={13} /> Generate Ideas</>}
              </button>
              {bResult && (
                <div className="p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ background: T.bgDeep, color: T.textSub }}>
                  {bResult}
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ color: T.textMuted }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
