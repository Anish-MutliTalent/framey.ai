import { useEffect, useRef, useState } from 'react';
import { GraduationCap, AlertCircle, Terminal } from 'lucide-react';
import { useAuth, API_BASE } from '../contexts/AuthContext';
import { T } from '../theme';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, config: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const IS_PLACEHOLDER = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your-google');

export function ERPLogin() {
  const { login } = useAuth();
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);

  // Only load the Google script when we have a real client ID
  useEffect(() => {
    if (IS_PLACEHOLDER) return;

    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleCredential,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280,
        });
      }
    };

    if (window.google) { init(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.body.appendChild(script);
  }, []);

  const handleCredential = async (response: { credential: string }) => {
    setLoading(true);
    setError('');
    try {
      await login(response.credential);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Dev bypass: hit the API with a fake token for a seeded email
  const devLogin = async () => {
    if (!devEmail.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: devEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Dev login failed');
      }
      const data = await res.json();
      localStorage.setItem('academia_token', data.access_token);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle at 60% 20%, rgba(0,0,0,0.03) 0%, transparent 60%)' }} />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: T.accent }}>
            <GraduationCap size={24} color="white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: T.text }}>Academia</h1>
            <p className="mt-0.5 text-sm" style={{ color: T.textMuted }}>School Management Platform</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl p-8 flex flex-col items-center gap-5 shadow-sm"
          style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="text-center">
            <h2 className="text-base font-semibold" style={{ color: T.text }}>Sign in</h2>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Use your school Google account
            </p>
          </div>

          {error && (
            <div className="w-full flex items-start gap-2 rounded-xl p-3 text-xs"
              style={{ background: T.dangerBg, color: T.danger, border: `1px solid rgba(220,38,38,0.2)` }}>
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: T.textMuted }}>
              <div className="w-4 h-4 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin" />
              Signing in…
            </div>
          ) : IS_PLACEHOLDER ? (
            /* Dev mode — no real client ID configured */
            <DevLoginPanel
              email={devEmail}
              onEmailChange={setDevEmail}
              onLogin={devLogin}
            />
          ) : (
            <div ref={buttonRef} />
          )}

          {!IS_PLACEHOLDER && (
            <p className="text-xs text-center" style={{ color: T.textMuted }}>
              Only pre-registered school accounts can sign in.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DevLoginPanel({
  email, onEmailChange, onLogin,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  onLogin: () => void;
}) {
  return (
    <div className="w-full space-y-3">
      {/* Warning banner */}
      <div className="flex items-start gap-2 rounded-xl p-3 text-xs"
        style={{ background: T.warningBg, color: T.warning, border: `1px solid rgba(217,119,6,0.2)` }}>
        <Terminal size={13} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Dev mode</span>
          <span className="text-stone-600 ml-1">— <code>VITE_GOOGLE_CLIENT_ID</code> not set.</span>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>
          Seeded email to log in as
        </label>
        <input
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onLogin()}
          placeholder="student1@springfield.edu"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: T.input,
            border: `1px solid ${T.inputBorder}`,
            color: T.text,
          }}
        />
      </div>

      <p className="text-xs" style={{ color: T.textMuted }}>
        Try: <code className="text-xs">tech@springfield.edu</code>,{' '}
        <code className="text-xs">alice@springfield.edu</code>,{' '}
        <code className="text-xs">student1@springfield.edu</code>
      </p>

      <button
        onClick={onLogin}
        disabled={!email.trim()}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: T.accent, color: '#FFFFFF' }}
      >
        Sign in (dev)
      </button>
    </div>
  );
}
