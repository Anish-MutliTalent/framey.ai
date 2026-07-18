import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Bell } from 'lucide-react';

interface TopBarProps { title?: string; }

export function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header
      className="flex items-center justify-between px-6 shrink-0"
      style={{
        background: T.card,
        borderBottom: `1px solid ${T.border}`,
        height: '52px',
      }}
    >
      <div>
        {title && (
          <h1 className="text-sm font-semibold" style={{ color: T.text }}>{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
          style={{ color: T.textMuted }}
        >
          <Bell size={15} />
        </button>
        <div className="flex items-center gap-2">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: T.accent, color: '#fff' }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-xs font-medium hidden sm:block" style={{ color: T.textSub }}>{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
