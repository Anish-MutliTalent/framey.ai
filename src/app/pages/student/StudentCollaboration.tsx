import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Users, MessageSquare, Calendar, Plus, Send, Clock, X, Search, UserPlus, Loader } from 'lucide-react';

interface Member { id: number; name: string; }
interface Group { id: number; name: string; created_at: string; members: Member[]; }
interface GroupMsg { id: number; content: string; sender_id: number; sender_name: string; created_at: string; }
interface GroupEvent { id: number; title: string; description: string; event_date: string; }

const fmtTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Stable helper — must be outside the component function ────────────────────
function GroupInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
      style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
  );
}

export function StudentCollaboration() {
  const { request } = useApi();
  const { user: me } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '' });
  // Member search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: number; name: string; email: string }[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadGroups = () =>
    request<Group[]>('/groups').then(g => {
      setGroups(g);
      if (g.length > 0 && !selected) setSelected(g[0]);
    }).catch(console.error).finally(() => setLoading(false));

  useEffect(() => { loadGroups(); }, [request]);

  useEffect(() => {
    if (!selected) return;
    const fetchMsgs = () => request<GroupMsg[]>(`/groups/${selected.id}/messages`).then(setMessages).catch(console.error);
    const fetchEvts = () => request<GroupEvent[]>(`/groups/${selected.id}/events`).then(setEvents).catch(console.error);
    fetchMsgs(); fetchEvts();
    pollRef.current = setInterval(fetchMsgs, 5000);
    return () => clearInterval(pollRef.current);
  }, [selected?.id, request]);

  const sendMsg = async () => {
    if (!msgInput.trim() || !selected) return;
    try {
      const msg = await request<GroupMsg>(`/groups/${selected.id}/messages`, { method: 'POST', body: { content: msgInput.trim() } });
      setMessages(prev => [...prev, msg]);
      setMsgInput('');
    } catch (e) { console.error(e); }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    const g = await request<Group>('/groups', { method: 'POST', body: { name: groupName } });
    setGroups(prev => [g, ...prev]);
    setSelected(g);
    setShowCreateGroup(false);
    setGroupName('');
  };

  const createEvent = async () => {
    if (!newEvent.title.trim() || !selected) return;
    const ev = await request<GroupEvent>(`/groups/${selected.id}/events`, { method: 'POST', body: newEvent });
    setEvents(prev => [...prev, ev]);
    setShowCreateEvent(false);
    setNewEvent({ title: '', description: '', event_date: '' });
  };

  const searchMembers = async (q: string) => {
    if (q.trim().length < 2) { setMemberResults([]); return; }
    setMemberSearching(true);
    try {
      const r = await request<{ id: number; name: string; email: string }[]>(`/users/search?q=${encodeURIComponent(q)}`);
      // Filter out existing members
      const existingIds = new Set(selected?.members.map(m => m.id) ?? []);
      setMemberResults(r.filter(u => !existingIds.has(u.id)));
    } finally { setMemberSearching(false); }
  };

  const addMember = async (userId: number, userName: string) => {
    if (!selected) return;
    await request(`/groups/${selected.id}/members`, { method: 'POST', body: { user_id: userId } });
    // Update local group member list
    setSelected(prev => prev ? { ...prev, members: [...prev.members, { id: userId, name: userName }] } : null);
    setGroups(prev => prev.map(g => g.id === selected.id
      ? { ...g, members: [...g.members, { id: userId, name: userName }] }
      : g
    ));
    setMemberResults(prev => prev.filter(u => u.id !== userId));
  };

  const nextEvent = events.filter(e => new Date(e.event_date) >= new Date())
    .sort((a, b) => +new Date(a.event_date) - +new Date(b.event_date))[0];

  return (
    <Layout title="Collaboration">
      <div className="flex" style={{ height: 'calc(100vh - 120px)', border: `1px solid ${T.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Group list */}
        <div className="w-64 shrink-0 flex flex-col" style={{ background: T.card, borderRight: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-xs font-semibold" style={{ color: T.text }}>Groups</span>
            <button onClick={() => setShowCreateGroup(true)} className="p-1.5 rounded-lg hover:bg-stone-100"
              style={{ color: T.accent }}><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="text-center py-8 text-xs" style={{ color: T.textMuted }}>Loading…</div>}
            {!loading && groups.length === 0 && (
              <div className="text-center py-10 px-4">
                <Users size={24} className="mx-auto mb-2 opacity-40" style={{ color: T.textMuted }} />
                <p className="text-xs mb-2" style={{ color: T.textMuted }}>No groups yet</p>
                <button onClick={() => setShowCreateGroup(true)} className="text-xs underline" style={{ color: T.accent }}>Create one</button>
              </div>
            )}
            {groups.map(g => (
              <div key={g.id} onClick={() => setSelected(g)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{ background: selected?.id === g.id ? T.bgDeep : 'transparent', borderBottom: `1px solid ${T.border}` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                  style={{ background: T.accentBg, color: T.accent }}>
                  {g.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{g.name}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{g.members?.length ?? 1} member{(g.members?.length ?? 1) !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col" style={{ background: T.bg }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ background: T.accentBg, color: T.accent }}>
                    {selected.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: T.text }}>{selected.name}</div>
                    <div className="text-xs" style={{ color: T.textMuted }}>{selected.members?.length ?? 1} members</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowMembers(true); setMemberSearch(''); setMemberResults([]); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-stone-100 transition-colors"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}>
                    <UserPlus size={13} /> Members
                  </button>
                  <button onClick={() => setShowCreateEvent(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-stone-100 transition-colors"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}>
                    <Calendar size={13} /> Add Event
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: T.textMuted }}>
                    <MessageSquare size={28} strokeWidth={1.5} />
                    <p className="text-xs">No messages yet. Start the discussion!</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2.5 ${msg.sender_id === me?.id ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: msg.sender_id === me?.id ? T.accent : T.bgDeep,
                        color: msg.sender_id === me?.id ? '#fff' : T.textSub,
                      }}>
                      {msg.sender_name[0].toUpperCase()}
                    </div>
                    <div className={msg.sender_id === me?.id ? 'text-right' : ''}>
                      <div className="flex items-baseline gap-2 mb-1">
                        {msg.sender_id !== me?.id && <span className="text-xs font-semibold" style={{ color: T.text }}>{msg.sender_name}</span>}
                        <span className="text-xs" style={{ color: T.textMuted }}>{fmtTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm px-3 py-2 rounded-xl inline-block text-left max-w-xs"
                        style={msg.sender_id === me?.id
                          ? { background: T.accent, color: '#fff', borderBottomRightRadius: 4 }
                          : { background: T.card, border: `1px solid ${T.border}`, color: T.text, borderBottomLeftRadius: 4 }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="px-4 py-3 shrink-0" style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2">
                  <input type="text" value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMsg()}
                    placeholder="Write a message…"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
                  <button onClick={sendMsg} disabled={!msgInput.trim()}
                    className="p-2.5 rounded-xl disabled:opacity-40"
                    style={{ background: T.accent, color: '#fff' }}>
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2" style={{ color: T.textMuted }}>
              <Users size={20} strokeWidth={1.5} />
              <span className="text-xs">Select or create a group</span>
            </div>
          )}
        </div>

        {/* Events panel */}
        <div className="w-72 shrink-0 flex flex-col p-5" style={{ background: T.card, borderLeft: `1px solid ${T.border}` }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2"
            style={{ color: T.textMuted }}>
            <Calendar size={13} /> Events & Deadlines
          </h3>
          {nextEvent && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: T.accent }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Next Deadline</div>
              <div className="text-base font-bold text-white mb-1">{nextEvent.title}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Clock size={11} /> {fmtDate(nextEvent.event_date)}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: T.textMuted }}>No events yet</p>
            ) : events.map(ev => (
              <div key={ev.id} className="p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
                <div className="text-xs font-semibold" style={{ color: T.text }}>{ev.title}</div>
                <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: T.textMuted }}>
                  <Calendar size={10} /> {fmtDate(ev.event_date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Members Modal */}
      <AnimatePresence>
        {showMembers && selected && (
          <Modal title={`Members — ${selected.name}`} onClose={() => setShowMembers(false)}>
            <div className="space-y-3">
              {/* Current members */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selected.members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: T.bgDeep }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: T.accent, color: '#fff' }}>{m.name[0]}</div>
                    <span className="text-xs" style={{ color: T.text }}>{m.name}</span>
                  </div>
                ))}
              </div>

              {/* Search to add */}
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '12px' }}>
                <label className="text-xs font-medium block mb-1.5" style={{ color: T.textSub }}>Add People</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5" style={{ color: T.textMuted }} />
                  <input
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); searchMembers(e.target.value); }}
                    placeholder="Search by name or email…"
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>

              {memberSearching && (
                <div className="flex justify-center py-2">
                  <Loader size={14} className="animate-spin" style={{ color: T.textMuted }} />
                </div>
              )}

              <div className="space-y-1 max-h-40 overflow-y-auto">
                {memberResults.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                    onClick={() => addMember(u.id, u.name)}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: T.bgDeep, color: T.accent }}>{u.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: T.text }}>{u.name}</div>
                      <div className="text-xs truncate" style={{ color: T.textMuted }}>{u.email}</div>
                    </div>
                    <Plus size={14} style={{ color: T.accent }} />
                  </div>
                ))}
                {!memberSearching && memberSearch.trim().length >= 2 && memberResults.length === 0 && (
                  <p className="text-center text-xs py-3" style={{ color: T.textMuted }}>No users found</p>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <Modal title="Create Group" onClose={() => setShowCreateGroup(false)}>
            <div className="space-y-3">
              <GroupInput value={groupName} onChange={setGroupName} placeholder="e.g. Study Group A" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateGroup(false)} className="text-xs px-3 py-2" style={{ color: T.textMuted }}>Cancel</button>
                <button onClick={createGroup} disabled={!groupName.trim()}
                  className="text-xs px-5 py-2 rounded-xl font-medium disabled:opacity-40"
                  style={{ background: T.accent, color: '#fff' }}>Create</button>
              </div>
            </div>
          </Modal>
        )}
        {showCreateEvent && (
          <Modal title="Add Event" onClose={() => setShowCreateEvent(false)}>
            <div className="space-y-3">
              <GroupInput value={newEvent.title} onChange={v => setNewEvent(p => ({ ...p, title: v }))} placeholder="Event title" />
              <GroupInput type="datetime-local" value={newEvent.event_date} onChange={v => setNewEvent(p => ({ ...p, event_date: v }))} placeholder="" />
              <textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)" rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateEvent(false)} className="text-xs px-3 py-2" style={{ color: T.textMuted }}>Cancel</button>
                <button onClick={createEvent} disabled={!newEvent.title.trim() || !newEvent.event_date}
                  className="text-xs px-5 py-2 rounded-xl font-medium disabled:opacity-40"
                  style={{ background: T.accent, color: '#fff' }}>Add Event</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.35)' }} />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 m-auto w-full max-w-sm h-fit z-50 rounded-2xl p-6 space-y-4 shadow-xl"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ color: T.textMuted }}><X size={16} /></button>
        </div>
        {children}
      </motion.div>
    </>
  );
}
