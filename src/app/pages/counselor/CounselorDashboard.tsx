import { Layout } from '../../components/erp/Layout';
import { CounselorChat } from '../../components/CounselorChat';
import { T } from '../../theme';
import { HeartHandshake } from 'lucide-react';

export function CounselorDashboard() {
  return (
    <Layout title="Counseling">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: T.accent + '14' }}>
            <HeartHandshake size={20} style={{ color: T.accent }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: T.text }}>Counseling Channel</h1>
            <p className="text-xs" style={{ color: T.textMuted }}>
              Private conversations with students. This channel is separate from school messages and collaboration.
            </p>
          </div>
        </div>
        <CounselorChat role="counselor" />
      </div>
    </Layout>
  );
}
