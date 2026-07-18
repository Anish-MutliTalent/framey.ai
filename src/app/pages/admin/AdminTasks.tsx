import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label, Textarea, Modal, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, CheckCircle2, Circle, Clock } from 'lucide-react';

interface User { id: number; name: string; }
interface Task {
  id: number; assignor: { name: string }; assignee: { name: string };
  title: string; description?: string; due_date?: string; status: string; created_at: string;
}
const STATUS_CFG = {
  pending:     { color: T.warning, icon: <Circle size={13} /> },
  in_progress: { color: T.info,    icon: <Clock size={13} /> },
  completed:   { color: T.success, icon: <CheckCircle2 size={13} /> },
};

export function AdminTasks() {
  const { request } = useApi();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ assigned_to: '', title: '', description: '', due_date: '' });

  const load = () => request<Task[]>('/admin/tasks').then(setTasks).catch(console.error);
  useEffect(() => { load(); request<User[]>('/admin/users').then(setUsers).catch(console.error); }, [request]);

  const create = async () => {
    await request('/admin/tasks', { method: 'POST', body: { ...form, assigned_to: Number(form.assigned_to), due_date: form.due_date || null } });
    setShowForm(false); setForm({ assigned_to: '', title: '', description: '', due_date: '' }); load();
  };
  const updateStatus = async (id: number, status: string) => {
    await request(`/admin/tasks/${id}`, { method: 'PATCH', body: { status } }); load();
  };

  return (
    <Layout title="Tasks">
      <div className="max-w-4xl space-y-5">
        <div className="flex justify-end">
          <Btn onClick={() => setShowForm(true)}><Plus size={13} /> Assign Task</Btn>
        </div>

        {showForm && (
          <Modal onClose={() => setShowForm(false)}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: T.textMuted }}>New Task</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Assign To</Label>
                  <Select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">Select user…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Select>
                </div>
                <div><Label>Due Date</Label>
                  <Input type="datetime-local" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
              </div>
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
                <Btn onClick={create}>Create</Btn>
              </div>
            </div>
          </Modal>
        )}

        {/* Kanban columns */}
        <div className="grid grid-cols-3 gap-4">
          {(['pending','in_progress','completed'] as const).map(status => {
            const cfg = STATUS_CFG[status];
            const col = tasks.filter(t => t.status === status);
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>
                    {status.replace('_',' ')}
                  </span>
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: `${cfg.color}15`, color: cfg.color }}>
                    {col.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.map(task => (
                    <div key={task.id} className="rounded-xl p-4 space-y-2"
                      style={{ background: T.card, border: `1px solid ${T.border}` }}>
                      <div className="text-xs font-semibold" style={{ color: T.text }}>{task.title}</div>
                      {task.description && <p className="text-xs line-clamp-2" style={{ color: T.textSub }}>{task.description}</p>}
                      <div className="text-xs" style={{ color: T.textMuted }}>→ {task.assignee.name}</div>
                      {task.due_date && <div className="text-xs" style={{ color: T.textMuted }}>Due {new Date(task.due_date).toLocaleDateString()}</div>}
                      <div className="flex gap-1 flex-wrap pt-1">
                        {(['pending','in_progress','completed'] as const).filter(s => s !== status).map(s => (
                          <button key={s} onClick={() => updateStatus(task.id, s)}
                            className="text-xs px-2 py-0.5 rounded-full capitalize transition-colors hover:opacity-80"
                            style={{ background: `${STATUS_CFG[s].color}12`, color: STATUS_CFG[s].color }}>
                            → {s.replace('_',' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!col.length && (
                    <div className="text-center py-6 text-xs rounded-xl"
                      style={{ color: T.textMuted, border: `1px dashed ${T.border}` }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
