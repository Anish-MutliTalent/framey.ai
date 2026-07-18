import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Empty, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { FileText } from 'lucide-react';

interface AuditLog {
  id: number; user: { name: string; email: string }; action: string;
  resource_type?: string; resource_id?: number; details?: string;
  ip_address?: string; created_at: string;
}

export function AdminAudit() {
  const { request } = useApi();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<AuditLog[]>('/admin/audit?limit=100').then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  return (
    <Layout title="Audit Log">
      <div className="max-w-5xl">
        {loading && <Skeleton rows={5} />}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: T.bgDeep, color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <span className="col-span-2">Time</span>
            <span className="col-span-2">User</span>
            <span className="col-span-3">Action</span>
            <span className="col-span-2">Resource</span>
            <span className="col-span-2">Details</span>
            <span className="col-span-1">IP</span>
          </div>
          {logs.map((log, idx) => (
            <div key={log.id} className="grid grid-cols-12 items-center px-4 py-2.5"
              style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
              <span className="col-span-2 text-xs" style={{ color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="col-span-2">
                <div className="text-xs font-medium truncate" style={{ color: T.text }}>{log.user.name}</div>
                <div className="text-xs truncate" style={{ color: T.textMuted }}>{log.user.email}</div>
              </div>
              <span className="col-span-3 text-xs font-semibold" style={{ color: T.accent, fontFamily: 'JetBrains Mono, monospace' }}>
                {log.action}
              </span>
              <span className="col-span-2 text-xs" style={{ color: T.textSub }}>
                {log.resource_type ? `${log.resource_type}#${log.resource_id}` : '—'}
              </span>
              <span className="col-span-2 text-xs truncate" style={{ color: T.textMuted }}>{log.details ?? '—'}</span>
              <span className="col-span-1 text-xs" style={{ color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                {log.ip_address ?? '—'}
              </span>
            </div>
          ))}
          {!loading && !logs.length && <Empty icon={<FileText size={18} />} text="No audit logs yet" />}
        </div>
      </div>
    </Layout>
  );
}
