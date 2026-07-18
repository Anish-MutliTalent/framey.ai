import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { T } from '../theme';
import { Send, MessageCircle, Plus, ArrowLeft } from 'lucide-react';

interface Partner { id: number; name: string; avatar_url?: string; email?: string }
interface Conversation { partner: Partner; last_message: { content: string; created_at: string; sender_id: number }; unread: number }
interface Msg { id: number; sender_id: number; mine: boolean; content: string; created_at: string }
interface Counselor { id: number; name: string; email: string; avatar_url?: string; specialty: string }

export function CounselorChat({ role }: { role: 'student' | 'counselor' }) {
  const { request } = useApi();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const data = await request<Conversation[]>('/counseling/conversations');
      setConversations(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadConversations();
    if (role === 'student') {
      request<Counselor[]>('/counseling/counselors').then(setCounselors).catch(() => {});
    }
  }, [role]);

  const openConversation = async (partnerId: number) => {
    setActiveId(partnerId);
    setShowNew(false);
    setLoadingMsgs(true);
    try {
      const msgs = await request<Msg[]>(`/counseling/messages/${partnerId}`);
      setMessages(msgs);
    } catch (e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !activeId) return;
    const body: any = { content: text.trim() };
    if (role === 'student') body.counselor_id = activeId;
    else body.student_user_id = activeId;
    try {
      const m = await request<Msg>('/counseling/messages', { method: 'POST', body });
      setMessages(prev => [...prev, m]);
      setText('');
      loadConversations();
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed to send');
    }
  };

  const activePartner = conversations.find(c => c.partner.id === activeId)?.partner
    ?? (role === 'student' ? counselors.find(c => c.id === activeId) as unknown as Partner : undefined);

  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}`, height: 'min(70vh, 560px)' }}>
      {/* Left: conversations */}
      <div className="w-64 shrink-0 flex flex-col" style={{ borderRight: `1px solid ${T.border}`, background: T.bg }}>
        <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>
            {role === 'student' ? 'Your counselors' : 'Students'}
          </span>
          {role === 'student' && (
            <button onClick={() => setShowNew(s => !s)} className="p-1 rounded-lg hover:opacity-70" style={{ color: T.accent }} title="New chat">
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {showNew && role === 'student' && (
            <div className="p-2 space-y-1" style={{ borderBottom: `1px solid ${T.border}` }}>
              <p className="text-xs px-1 pb-1" style={{ color: T.textMuted }}>Start a new chat</p>
              {counselors.length === 0 && <p className="text-xs px-1" style={{ color: T.textMuted }}>No counselors available.</p>}
              {counselors.map(c => (
                <button key={c.id} onClick={() => openConversation(c.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:opacity-80"
                  style={{ background: T.card }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: T.bgDeep, color: T.accent }}>{c.name?.[0]}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: T.text }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: T.textMuted }}>{c.specialty}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {conversations.length === 0 && !showNew && (
            <p className="text-xs p-4 text-center" style={{ color: T.textMuted }}>
              {role === 'student' ? 'No conversations yet. Tap + to start.' : 'No student messages yet.'}
            </p>
          )}
          {conversations.map(c => (
            <button key={c.partner.id} onClick={() => openConversation(c.partner.id)}
              className="w-full flex items-center gap-2 px-3 py-3 text-left hover:opacity-80 transition-opacity"
              style={{ background: activeId === c.partner.id ? T.card : 'transparent', borderBottom: `1px solid ${T.border}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: T.bgDeep, color: T.textSub }}>{c.partner.name?.[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: T.text }}>{c.partner.name}</p>
                <p className="text-xs truncate" style={{ color: T.textMuted }}>{c.last_message.content}</p>
              </div>
              {c.unread > 0 && (
                <span className="text-xs font-bold rounded-full px-1.5" style={{ background: T.accent, color: '#fff' }}>{c.unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: T.textMuted }}>
            <MessageCircle size={36} strokeWidth={1.2} />
            <p className="text-sm mt-3">Select a conversation to start chatting.</p>
            <p className="text-xs mt-1">This channel is private to you and your counselor.</p>
          </div>
        ) : (
          <>
            <div className="p-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setActiveId(null)} className="lg:hidden p-1 rounded-lg" style={{ color: T.textMuted }}>
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: T.bgDeep, color: T.accent }}>{activePartner?.name?.[0] ?? '?'}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{activePartner?.name ?? 'Chat'}</p>
                <p className="text-xs" style={{ color: T.success }}>Private channel</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: T.bg }}>
              {loadingMsgs ? (
                <p className="text-xs text-center" style={{ color: T.textMuted }}>Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-center" style={{ color: T.textMuted }}>Say hello 👋</p>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%] px-3 py-2 rounded-2xl text-sm"
                      style={{
                        background: m.mine ? T.accent : T.card,
                        color: m.mine ? '#fff' : T.text,
                        border: m.mine ? 'none' : `1px solid ${T.border}`,
                      }}>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      <p className="text-xs mt-0.5" style={{ color: m.mine ? 'rgba(255,255,255,0.7)' : T.textMuted }}>
                        {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
            <div className="flex items-center gap-2 p-3" style={{ borderTop: `1px solid ${T.border}` }}>
              <input type="text" value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type a private message…"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              <button onClick={send} disabled={!text.trim()}
                className="p-2 rounded-xl disabled:opacity-40 hover:opacity-80"
                style={{ background: T.accent, color: '#fff' }}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
