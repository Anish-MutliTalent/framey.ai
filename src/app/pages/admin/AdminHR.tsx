import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Empty, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T, ROLE_COLORS } from '../../theme';
import { Mail, UserCog } from 'lucide-react';

interface User {
  id: number; name: string; email: string; avatar_url?: string;
  roles: { role: string }[]; is_active: boolean;
}
const STAFF_ROLES = ['teacher','class_teacher','coordinator','principal','tech_admin'];

export function AdminHR() {
  const { request } = useApi();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<User[]>('/admin/users')
      .then(u => setStaff(u.filter(x => x.roles.some(r => STAFF_ROLES.includes(r.role)))))
      .catch(console.error).finally(() => setLoading(false));
  }, [request]);

  return (
    <Layout title="HR / Staff">
      <div className="max-w-4xl space-y-4">
        <p className="text-xs" style={{ color: T.textMuted }}>{staff.length} staff members</p>
        {loading && <Skeleton />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staff.map(u => (
            <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: T.card, border: `1px solid ${T.border}`, opacity: u.is_active ? 1 : 0.5 }}>
              {u.avatar_url
                ? <img src={u.avatar_url} className="w-10 h-10 rounded-full shrink-0" alt="" />
                : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: T.bgDeep, color: T.accent }}>{u.name[0]}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ color: T.text }}>{u.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Mail size={10} style={{ color: T.textMuted }} />
                  <span className="text-xs truncate" style={{ color: T.textMuted }}>{u.email}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {u.roles.filter(r => STAFF_ROLES.includes(r.role)).map(r => (
                    <span key={r.role} className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: `${ROLE_COLORS[r.role] ?? T.accent}15`, color: ROLE_COLORS[r.role] ?? T.accent }}>
                      {r.role.replace('_',' ')}
                    </span>
                  ))}
                </div>
              </div>
              {!u.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: T.dangerBg, color: T.danger }}>Inactive</span>
              )}
            </div>
          ))}
        </div>
        {!loading && !staff.length && <Empty icon={<UserCog size={20} />} text="No staff members found" />}
      </div>
    </Layout>
  );
}
