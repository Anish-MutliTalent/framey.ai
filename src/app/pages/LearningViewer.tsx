import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { T } from '../theme';
import { ChevronLeft, ExternalLink } from 'lucide-react';

export function LearningViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const title = searchParams.get('title') ?? 'Learning Resource';
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (url && title) {
      localStorage.setItem('academia_last_learning', JSON.stringify({ url, title, timestamp: Date.now() }));
    }
  }, [url, title]);

  if (!url) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: T.bg }}>
        <p className="text-sm" style={{ color: T.textMuted }}>No lesson selected. Go to the Library first.</p>
        <button onClick={() => navigate('/student/library')}
          className="px-5 py-2 rounded-xl text-sm font-medium"
          style={{ background: T.accent, color: '#fff' }}>
          Go to Library
        </button>
      </div>
    );
  }

  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { /* ignore */ }

  return (
    <div className="flex flex-col h-screen" style={{ background: T.bg }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: T.card, borderBottom: `1px solid ${T.border}`, height: '52px' }}>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: T.textMuted }}>
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-sm font-semibold truncate max-w-md" style={{ color: T.text }}>{title}</h1>
        <button onClick={() => window.open(url, '_blank')}
          className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
          style={{ color: T.textMuted }}>
          <ExternalLink size={14} /> Open in tab
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!blocked ? (
          <iframe
            src={url}
            className="w-full h-full border-none"
            title="Learning Content"
            onError={() => setBlocked(true)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-5 max-w-sm mx-auto text-center px-6">
            <div className="p-4 rounded-2xl" style={{ background: T.bgDeep }}>
              <ExternalLink size={28} style={{ color: T.textMuted }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: T.text }}>
                Content can't be embedded
              </h3>
              <p className="text-xs" style={{ color: T.textMuted }}>
                {hostname} does not allow embedding due to security restrictions.
              </p>
            </div>
            <button onClick={() => window.open(url, '_blank')}
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: T.accent, color: '#fff' }}>
              Open in New Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
