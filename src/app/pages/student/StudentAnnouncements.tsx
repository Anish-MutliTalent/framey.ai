import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Empty, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { RenderText } from '../../components/erp/RenderText';
import { T } from '../../theme';
import { Bell, AlertTriangle, Globe, Users } from 'lucide-react';

interface Announcement {
  id: number; author: { name: string }; title: string; content: string;
  scope: string; priority: string; created_at: string;
}

export function StudentAnnouncements() {
  const { request } = useApi();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<Announcement[]>('/announcements/').then(setList).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  return (
    <Layout title="Announcements">
      <div className="max-w-xl space-y-3">
        {loading && <Skeleton />}
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
                    {ann.scope === 'school_wide' ? <><Globe size={10} /> School-wide</> : <><Users size={10} /> Class</>}
                  </span>
                </div>
                <RenderText text={ann.content} tag="p" className="text-xs mt-2" style={{ color: T.textSub }} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: T.textMuted }}>
              <span>{ann.author.name}</span>
              <span>·</span>
              <span>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        ))}
        {!loading && !list.length && <Empty icon={<Bell size={20} />} text="No announcements" />}
      </div>
    </Layout>
  );
}
