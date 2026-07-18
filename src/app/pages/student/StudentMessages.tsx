import { useState, useEffect, useRef } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Search, PenSquare, Send, ChevronLeft, UserPlus, X, Loader } from 'lucide-react';

interface UserInfo { id: number; name: string; email: string; avatar_url?: string; }
interface DMData { id: number; sender_id: number; receiver_id: number; content: string; sender_name: string; created_at: string; }
interface Conversation { user: UserInfo; last_message: DMData | null; }

const fmt = (dateStr: string) => {
  const d = new Date(dateStr), now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString();
};

export function StudentMessages() {
  const { request } = useApi();
  const { user: me } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [partner, setPartner] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<DMData[]>([]);
  const [input, setInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [emailSearch, setEmailSearch] = useState(''); // used as name/email query
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileShowList, setMobileShowList] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConversations = () =>
    request<Conversation[]>('/conversations').then(setConversations).catch(console.error).finally(() => setLoading(false));

  useEffect(() => { loadConversations(); }, [request]);

  useEffect(() => {
    if (!partner) return;
    const fetch = () => request<DMData[]>(`/messages/${partner.id}`).then(setMessages).catch(console.error);
    fetch();
    pollRef.current = setInterval(fetch, 5000);
    return () => clearInterval(pollRef.current);
  }, [partner?.id, request]);

  // Email search debounce
  useEffect(() => {
    if (!emailSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await request<UserInfo[]>(`/users/search?q=${encodeURIComponent(emailSearch)}`);
        setSearchResults(r);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [emailSearch, request]);

  const send = async () => {
    if (!input.trim() || !partner) return;
    try {
      const msg = await request<DMData>(`/messages/${partner.id}`, { method: 'POST', body: { content: input.trim() } });
      setMessages(prev => [...prev, msg]);
      setInput('');
      loadConversations();
    } catch (e) { console.error(e); }
  };

  const startConvo = (u: UserInfo) => {
    setPartner(u);
    setShowAdd(false);
    setEmailSearch('');
    setSearchResults([]);
    setMobileShowList(false);
    if (!conversations.find(c => c.user.id === u.id)) {
      setConversations(prev => [{ user: u, last_message: null }, ...prev]);
    }
  };

  const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) => (
    <div className={`${size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ background: T.accent, color: '#fff' }}>
      {name[0].toUpperCase()}
    </div>
  );

  return (
    <Layout title="Messages">
      <div className="flex" style={{ height: 'calc(100vh - 120px)', border: `1px solid ${T.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Thread list */}
        <div className={`${partner && !mobileShowList ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 shrink-0`}
          style={{ borderRight: `1px solid ${T.border}`, background: T.card }}>
          <div className="p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: T.text }}>Messages</h2>
              <button onClick={() => setShowAdd(true)}
                className="p-1.5 rounded-lg transition-colors hover:bg-stone-100"
                style={{ color: T.textMuted }}>
                <PenSquare size={16} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5" style={{ color: T.textMuted }} />
              <input placeholder="Search…" className="w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="flex items-center justify-center h-16"><Loader size={16} className="animate-spin" style={{ color: T.textMuted }} /></div>}
            {!loading && conversations.length === 0 && (
              <div className="text-center py-10 text-xs" style={{ color: T.textMuted }}>
                No conversations yet.{' '}
                <button onClick={() => setShowAdd(true)} className="underline">Start one</button>
              </div>
            )}
            {conversations.map(c => (
              <div key={c.user.id} onClick={() => { setPartner(c.user); setMobileShowList(false); }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{
                  background: partner?.id === c.user.id ? T.bgDeep : 'transparent',
                  borderBottom: `1px solid ${T.border}`,
                }}>
                <Avatar name={c.user.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: T.text }}>{c.user.name}</span>
                    <span className="text-xs" style={{ color: T.textMuted }}>
                      {c.last_message ? fmt(c.last_message.created_at) : ''}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: T.textMuted }}>
                    {c.last_message?.content ?? 'Start a conversation'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${!mobileShowList || !partner ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}
          style={{ background: T.bg }}>
          {partner ? (
            <>
              <div className="flex items-center gap-3 px-5 py-3 shrink-0"
                style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
                <button onClick={() => setMobileShowList(true)} className="md:hidden" style={{ color: T.textMuted }}>
                  <ChevronLeft size={20} />
                </button>
                <Avatar name={partner.name} size="md" />
                <div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>{partner.name}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{partner.email}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id}
                    className={`flex flex-col max-w-xs ${msg.sender_id === me?.id ? 'ml-auto items-end' : 'items-start'}`}>
                    <div className="px-4 py-2.5 rounded-2xl text-sm"
                      style={msg.sender_id === me?.id
                        ? { background: T.accent, color: '#fff', borderBottomRightRadius: 4 }
                        : { background: T.card, border: `1px solid ${T.border}`, color: T.text, borderBottomLeftRadius: 4 }}>
                      {msg.content}
                    </div>
                    <span className="text-xs mt-1" style={{ color: T.textMuted }}>{fmt(msg.created_at)}</span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="px-5 py-3 shrink-0" style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <input type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
                  <button onClick={send} disabled={!input.trim()}
                    className="p-2.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: T.accent, color: '#fff' }}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs" style={{ color: T.textMuted }}>
              Select a conversation to start
            </div>
          )}
        </div>
      </div>

      {/* Add contact modal */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setEmailSearch(''); setSearchResults([]); } }}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: T.text }}>
                <UserPlus size={16} /> New Conversation
              </h3>
              <button onClick={() => { setShowAdd(false); setEmailSearch(''); setSearchResults([]); }}
                style={{ color: T.textMuted }}><X size={16} /></button>
            </div>
            <p className="text-xs" style={{ color: T.textMuted }}>Search by name or email.</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5" style={{ color: T.textMuted }} />
              <input type="text" value={emailSearch} onChange={e => setEmailSearch(e.target.value)}
                placeholder="Name or email…" autoFocus
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searching && <div className="flex justify-center py-4"><Loader size={16} className="animate-spin" style={{ color: T.textMuted }} /></div>}
              {!searching && searchResults.map(u => (
                <div key={u.id} onClick={() => startConvo(u)}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                  <Avatar name={u.name} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: T.text }}>{u.name}</div>
                    <div className="text-xs" style={{ color: T.textMuted }}>{u.email}</div>
                  </div>
                </div>
              ))}
              {!searching && emailSearch.trim() && searchResults.length === 0 && (
                <p className="text-center text-xs py-4" style={{ color: T.textMuted }}>No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
