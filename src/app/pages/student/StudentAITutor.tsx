import { useState, useRef, useEffect } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Send, Sparkles, Bot, Loader, Bookmark, Search, ArrowRight } from 'lucide-react';

interface Message { role: 'user' | 'ai'; content: string; }

const STARTERS = [
  "Help me understand photosynthesis",
  "I'm stuck on quadratic equations",
  "Explain the causes of World War 1",
  "What is Newton's third law?",
];

export function StudentAITutor() {
  const { request } = useApi();
  const { user } = useAuth();
  const [tab, setTab] = useState<'chat' | 'library'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello! I'm your AI tutor. I won't give you direct answers — instead I'll guide you to discover solutions yourself. What would you like to explore today?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.content }));
      const data = await request<{ response: string }>('/ai/chat', {
        method: 'POST',
        body: { message: msg, history },
      });
      setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't reach the AI service. Make sure ANTHROPIC_API_KEY is configured." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="AI Tutor">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit mb-5" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
        {(['chat', 'library'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
            style={tab === t
              ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: T.textMuted }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-4">
            {/* Starter chips — show only when just the greeting is present */}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs px-3 py-2 rounded-full transition-all hover:opacity-80"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 max-w-2xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={msg.role === 'ai'
                    ? { background: T.bgDeep, color: T.accent }
                    : { background: T.accent, color: '#fff' }}>
                  {msg.role === 'ai' ? <Bot size={15} /> : (user?.name?.[0]?.toUpperCase() ?? 'U')}
                </div>
                {/* Bubble */}
                <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={msg.role === 'ai'
                    ? { background: T.card, border: `1px solid ${T.border}`, color: T.text, borderTopLeftRadius: 4 }
                    : { background: T.accent, color: '#fff', borderTopRightRadius: 4 }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 max-w-2xl">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: T.bgDeep, color: T.accent }}>
                  <Bot size={15} />
                </div>
                <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textMuted }}>
                  <Loader size={13} className="animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="relative max-w-3xl">
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask a question about your lessons…"
                disabled={loading}
                className="w-full pl-5 pr-14 py-3.5 rounded-2xl text-sm outline-none"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="absolute right-3 top-2.5 p-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'library' && <LibraryTab />}
    </Layout>
  );
}

function LibraryTab() {
  const resources = [
    { title: "Understanding Gestalt", type: "Summary", date: "Yesterday" },
    { title: "Color Theory Basics", type: "Quiz Review", date: "2 days ago" },
    { title: "Typography Rules", type: "Cheat Sheet", date: "Last week" },
  ];
  const [search, setSearch] = useState('');
  const filtered = resources.filter(r => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-3" style={{ color: T.textMuted }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search saved insights…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
      </div>
      <div className="space-y-2">
        {filtered.map((item, i) => (
          <div key={i} className="group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all hover:opacity-80"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: T.bgDeep }}>
                <Bookmark size={16} style={{ color: T.accent }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: T.text }}>{item.title}</div>
                <div className="text-xs" style={{ color: T.textMuted }}>{item.type} · {item.date}</div>
              </div>
            </div>
            <ArrowRight size={15} style={{ color: T.textMuted }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: T.textMuted }}>
            No saved insights yet
          </div>
        )}
      </div>
    </div>
  );
}
