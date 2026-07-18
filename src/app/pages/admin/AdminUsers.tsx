import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label, Modal, Skeleton, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T, ROLE_COLORS } from '../../theme';
import { Plus, X, UserCheck, UserX } from 'lucide-react';

interface User {
  id: number; name: string; email: string; avatar_url?: string;
  roles: { role: string }[]; is_active: boolean;
}
const ALL_ROLES = ['student','teacher','class_teacher','coordinator','principal','tech_admin'];

export function AdminUsers() {
  const { request } = useApi();
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', email: '', roles: [] as string[] });
  const [editRoles, setEditRoles] = useState<{ user_id: number; roles: string[] } | null>(null);
  const [search, setSearch]     = useState('');

  const load = () => request<User[]>('/admin/users').then(setUsers).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); }, [request]);

  const createUser = async () => {
    await request('/admin/users', { method: 'POST', body: form });
    setShowForm(false); setForm({ name: '', email: '', roles: [] }); load();
  };
  const saveRoles = async () => {
    if (!editRoles) return;
    await request(`/admin/users/${editRoles.user_id}/roles`, { method: 'PUT', body: { roles: editRoles.roles } });
    setEditRoles(null); load();
  };
  const toggleActive = async (id: number) => {
    await request(`/admin/users/${id}/toggle-active`, { method: 'PUT' }); load();
  };
  const toggleRole = (roles: string[], role: string) =>
    roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role];

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Users">
      <div className="max-w-4xl space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users…" className="max-w-xs" />
          <Btn onClick={() => setShowForm(true)} className="ml-auto">
            <Plus size={13} /> Add User
          </Btn>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>New User</h3>
              <button onClick={() => setShowForm(false)} style={{ color: T.textMuted }}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Full Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>School Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_ROLES.map(role => (
                  <button key={role} onClick={() => setForm(p => ({ ...p, roles: toggleRole(p.roles, role) }))}
                    className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                    style={{
                      background: form.roles.includes(role) ? `${ROLE_COLORS[role]}18` : T.bgDeep,
                      color: form.roles.includes(role) ? ROLE_COLORS[role] : T.textMuted,
                      border: `1px solid ${form.roles.includes(role) ? ROLE_COLORS[role] + '50' : T.border}`,
                    }}>
                    {role.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn onClick={createUser}>Create</Btn>
            </div>
          </div>
        )}

        {/* User list */}
        {loading ? <Skeleton /> : (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {filtered.map((user, idx) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: idx % 2 === 0 ? T.card : T.bg,
                  borderBottom: `1px solid ${T.border}`,
                  opacity: user.is_active ? 1 : 0.5,
                }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="" />
                  : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: T.bgDeep, color: T.accent }}>{user.name[0]}</div>}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: T.text }}>{user.name}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{user.email}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map(r => (
                    <span key={r.role} className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: `${ROLE_COLORS[r.role] ?? T.accent}15`, color: ROLE_COLORS[r.role] ?? T.accent }}>
                      {r.role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditRoles({ user_id: user.id, roles: user.roles.map(r => r.role) })}
                    className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-stone-100"
                    style={{ color: T.accent }}>Edit Roles</button>
                  <button onClick={() => toggleActive(user.id)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-stone-100"
                    style={{ color: user.is_active ? T.success : T.danger }}
                    title={user.is_active ? 'Deactivate' : 'Activate'}>
                    {user.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && <Empty text="No users found" />}
          </div>
        )}

        {/* Edit roles modal */}
        {editRoles && (
          <Modal onClose={() => setEditRoles(null)}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: T.textMuted }}>Edit Roles</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(role => (
                <button key={role}
                  onClick={() => setEditRoles(p => p ? { ...p, roles: toggleRole(p.roles, role) } : null)}
                  className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                  style={{
                    background: editRoles.roles.includes(role) ? `${ROLE_COLORS[role]}18` : T.bgDeep,
                    color: editRoles.roles.includes(role) ? ROLE_COLORS[role] : T.textMuted,
                    border: `1px solid ${editRoles.roles.includes(role) ? ROLE_COLORS[role] + '50' : T.border}`,
                  }}>
                  {role.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn variant="ghost" onClick={() => setEditRoles(null)}>Cancel</Btn>
              <Btn onClick={saveRoles}>Save</Btn>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
