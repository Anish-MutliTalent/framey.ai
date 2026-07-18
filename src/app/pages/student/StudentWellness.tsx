import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth, API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { CounselorChat } from '../../components/CounselorChat';
import {
  Phone, MessageCircle, BookOpen, Clock, Sun, Cloud, CloudRain, Wind, X,
  HeartPulse, Plus, Trash2, Stethoscope, Smile, Meh, Frown,
  FileText, Upload, CheckCircle2, XCircle, AlertCircle, Activity,
} from 'lucide-react';

// ── Breathing exercise (kept as one optional tool) ───────────────────────────
function BreathingExercise({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [timeLeft, setTimeLeft] = useState(60);
  const [instruction, setInstruction] = useState('Breathe In');

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => { if (p <= 1) { clearInterval(t); onDone(); return 0; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [onDone]);

  useEffect(() => {
    const t = setInterval(() => setInstruction(p => p === 'Breathe In' ? 'Breathe Out' : 'Breathe In'), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-6 text-center relative h-full min-h-[300px]">
      <button onClick={onSkip} className="absolute top-0 right-0 flex items-center gap-1 text-xs hover:opacity-70" style={{ color: T.textMuted }}>
        Skip <X size={14} />
      </button>
      <h3 className="text-base font-medium mb-6" style={{ color: T.text }}>Let's take a moment.</h3>
      <div className="relative flex items-center justify-center mb-6">
        <motion.div className="absolute rounded-full"
          animate={{ scale: [1, 2, 1], opacity: [0.15, 0.05, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 180, height: 180, background: 'rgba(79,70,229,0.12)' }} />
        <motion.div className="relative z-10 rounded-full flex items-center justify-center text-sm font-medium"
          animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 100, height: 100, background: T.bgDeep, color: T.accent, border: `2px solid ${T.border}` }}>
          {instruction}
        </motion.div>
      </div>
      <div className="font-mono text-sm mb-2" style={{ color: T.textMuted }}>00:{timeLeft.toString().padStart(2, '0')}</div>
    </motion.div>
  );
}

// ── Mood check-in ────────────────────────────────────────────────────────────
const MOODS = [
  { value: 5, label: 'Great', icon: Smile, color: '#16A34A' },
  { value: 4, label: 'Good', icon: Sun, color: T.warning },
  { value: 3, label: 'Okay', icon: Meh, color: T.info },
  { value: 2, label: 'Low', icon: Cloud, color: T.textSub },
  { value: 1, label: 'Struggling', icon: Frown, color: '#EF4444' },
];

function MoodCard() {
  const { request } = useApi();
  const [today, setToday] = useState<number | null>(null);
  const [history, setHistory] = useState<{ id: number; mood: number; note?: string | null; created_at: string }[]>([]);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [breathing, setBreathing] = useState(false);

  const load = async () => {
    try {
      const h = await request<any[]>('/wellness/mood');
      setHistory(h);
      const t = new Date().toDateString();
      const todays = h.find(m => new Date(m.created_at).toDateString() === t);
      setToday(todays ? todays.mood : null);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const pick = (m: number) => {
    setToday(m);
    if (m <= 2) setBreathing(true);
  };

  const save = async (m: number) => {
    try {
      await request('/wellness/mood', { method: 'POST', body: { mood: m, note: note || null } });
      setNote(''); setShowNote(false);
      await load();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden min-h-[260px] flex flex-col justify-center"
      style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <AnimatePresence mode="wait">
        {breathing ? (
          <BreathingExercise key="b" onDone={() => setBreathing(false)} onSkip={() => setBreathing(false)} />
        ) : today === null ? (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: T.text }}>How are you feeling today?</h2>
            <div className="flex justify-between gap-2">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => pick(m.value)}
                  className="flex flex-col items-center gap-2 px-2 py-3 rounded-2xl flex-1 transition-all hover:opacity-80"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
                  <m.icon size={26} strokeWidth={1.5} style={{ color: m.color }} />
                  <span className="text-xs font-medium" style={{ color: T.textSub }}>{m.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center">
            <button onClick={() => setToday(null)} className="absolute top-4 right-4 hover:opacity-70" style={{ color: T.textMuted }}><X size={16} /></button>
            {(() => {
              const cfg = MOODS.find(m => m.value === today)!;
              return (
                <>
                  <cfg.icon size={40} strokeWidth={1.5} style={{ color: cfg.color }} />
                  <p className="text-sm font-semibold mt-3" style={{ color: T.text }}>You're feeling {cfg.label.toLowerCase()}.</p>
                  {!showNote ? (
                    <button onClick={() => setShowNote(true)} className="mt-3 text-xs underline" style={{ color: T.accent }}>Add a note</button>
                  ) : (
                    <div className="w-full max-w-sm mt-3 space-y-2">
                      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What's on your mind?"
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-y"
                        style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text, minHeight: 50 }} />
                      <button onClick={() => save(today)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: T.accent, color: '#fff' }}>Save</button>
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>Recent</p>
          <div className="flex gap-1.5 flex-wrap">
            {history.slice(0, 14).map(h => {
              const cfg = MOODS.find(m => m.value === h.mood)!;
              return <cfg.icon key={h.id} size={16} style={{ color: cfg.color }} title={`${cfg.label} · ${new Date(h.created_at).toLocaleDateString()}`} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Journal ──────────────────────────────────────────────────────────────────
function JournalCard() {
  const { request } = useApi();
  const [entries, setEntries] = useState<{ id: number; title: string; content: string; created_at: string }[]>([]);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = async () => {
    try { setEntries(await request<any[]>('/wellness/journal')); } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!content.trim()) return;
    try {
      await request('/wellness/journal', { method: 'POST', body: { title: title.trim() || 'Untitled', content } });
      setTitle(''); setContent(''); setShow(false);
      await load();
    } catch (e) { console.error(e); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    try { await request(`/wellness/journal/${id}`, { method: 'DELETE' }); await load(); } catch (e) { console.error(e); }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: T.text }}>Private Journal</h2>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
          style={{ background: T.bgDeep, color: T.accent, border: `1px solid ${T.border}` }}>
          <Plus size={12} /> New entry
        </button>
      </div>

      {show && (
        <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write…"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text, minHeight: 80 }} />
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: T.accent, color: '#fff' }}>Save</button>
            <button onClick={() => { setShow(false); setTitle(''); setContent(''); }} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: T.textMuted }}>Cancel</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>A private space to reflect. No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="group p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: T.text }}>{e.title}</p>
                <button onClick={() => del(e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: T.danger }}><Trash2 size={12} /></button>
              </div>
              <p className="text-xs mt-1 line-clamp-3 whitespace-pre-wrap" style={{ color: T.textSub }}>{e.content}</p>
              <p className="text-xs mt-1" style={{ color: T.textMuted }}>{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Infirmary history ────────────────────────────────────────────────────────
function InfirmaryCard() {
  const { request } = useApi();
  const [visits, setVisits] = useState<any[]>([]);
  useEffect(() => {
    request<any[]>('/wellness/infirmary-visits').then(setVisits).catch(() => {});
  }, []);
  return (
    <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope size={16} style={{ color: T.success }} />
        <h2 className="text-sm font-semibold" style={{ color: T.text }}>Infirmary History</h2>
      </div>
      {visits.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>No infirmary visits on record. Stay healthy!</p>
      ) : (
        <div className="space-y-2">
          {visits.map(v => (
            <div key={v.id} className="p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: T.text }}>{v.reason}</p>
                <span className="text-xs" style={{ color: T.textMuted }}>{new Date(v.visited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              {v.treatment && <p className="text-xs mt-1" style={{ color: T.textSub }}>Treatment: {v.treatment}</p>}
              {v.notes && <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{v.notes}</p>}
              <div className="flex gap-1 mt-1">
                {v.sent_home && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: T.warningBg, color: T.warning }}>Sent home</span>}
                {v.follow_up && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: T.dangerBg, color: T.danger }}>Follow-up</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Medical conditions ───────────────────────────────────────────────────────
function MedicalConditionsCard() {
  const { request } = useApi();
  const [items, setItems] = useState<{ id: number; condition: string; notes?: string | null; created_at: string }[]>([]);
  const [show, setShow] = useState(false);
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    try { setItems(await request<any[]>('/wellness/conditions')); } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!condition.trim()) return;
    try {
      await request('/wellness/conditions', { method: 'POST', body: { condition: condition.trim(), notes: notes || null } });
      setCondition(''); setNotes(''); setShow(false);
      await load();
    } catch (e) { alert((e as Error).message || 'Failed'); }
  };

  const del = async (id: number) => {
    if (!confirm('Remove this condition?')) return;
    try { await request(`/wellness/conditions/${id}`, { method: 'DELETE' }); await load(); } catch (e) { console.error(e); }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: T.warning }} />
          <h2 className="text-sm font-semibold" style={{ color: T.text }}>Medical Conditions</h2>
        </div>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
          style={{ background: T.bgDeep, color: T.accent, border: `1px solid ${T.border}` }}>
          <Plus size={12} /> Add
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: T.textMuted }}>
        Visible to the school nurses and your teachers so they can support you.
      </p>

      {show && (
        <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <input value={condition} onChange={e => setCondition(e.target.value)} placeholder="e.g. Asthma, Peanut allergy, Diabetes"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional) — triggers, medication, etc."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: T.accent, color: '#fff' }}>Save</button>
            <button onClick={() => { setShow(false); setCondition(''); setNotes(''); }} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: T.textMuted }}>Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>No conditions listed.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map(c => (
            <div key={c.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: T.warningBg, color: T.warning, border: `1px solid ${T.warning}40` }}>
              <span className="text-xs font-medium">{c.condition}</span>
              <button onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-70 transition-opacity" style={{ color: T.warning }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Medical certificates ─────────────────────────────────────────────────────
const CERT_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: T.warning, icon: Clock },
  approved: { label: 'Approved', color: T.success, icon: CheckCircle2 },
  declined: { label: 'Declined', color: T.danger, icon: XCircle },
};

function MedicalCertificatesCard() {
  const { request } = useApi();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try { setItems(await request<any[]>('/wellness/certificates')); } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const certUrl = (id: number) => `${API_BASE}/wellness/certificates/${id}/raw${token ? `?token=${token}` : ''}`;

  const save = async () => {
    if (!file || !start) { setError('Choose a file and a start date.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('start_date', start);
      fd.append('end_date', end || start);
      await request('/wellness/certificates', { method: 'POST', body: fd });
      setFile(null); setStart(''); setEnd(''); setShow(false);
      await load();
    } catch (e) {
      setError((e instanceof Error ? e : new Error(String(e))).message || 'Failed to upload');
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: T.info }} />
          <h2 className="text-sm font-semibold" style={{ color: T.text }}>Medical Certificates</h2>
        </div>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
          style={{ background: T.bgDeep, color: T.accent, border: `1px solid ${T.border}` }}>
          <Plus size={12} /> Upload
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: T.textMuted }}>
        Upload a medical certificate to justify an absence. Your class teacher will review and approve or decline it.
      </p>

      {show && (
        <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs cursor-pointer hover:opacity-80 w-fit"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
            <Upload size={12} /> {file ? file.name : 'Choose PDF or image'}
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.gif"
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs block mb-1" style={{ color: T.textMuted }}>Start date</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: T.textMuted }}>End date (optional)</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
          </div>
          {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
              {saving ? 'Uploading…' : 'Upload'}
            </button>
            <button onClick={() => { setShow(false); setFile(null); setStart(''); setEnd(''); setError(''); }} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: T.textMuted }}>Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs" style={{ color: T.textMuted }}>No certificates uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(c => {
            const st = CERT_STATUS[c.status] ?? CERT_STATUS.pending;
            const SIcon = st.icon;
            return (
              <div key={c.id} className="p-3 rounded-xl" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2">
                  <a href={certUrl(c.id)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 min-w-0 flex-1"
                    style={{ color: T.text }}>
                    <FileText size={13} style={{ color: T.textSub }} />
                    <span className="truncate">{c.original_name}</span>
                  </a>
                  <span className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: st.color }}>
                    <SIcon size={12} /> {st.label}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: T.textMuted }}>
                  {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {c.end_date && c.end_date !== c.start_date
                    ? ` – ${new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </p>
                {c.teacher_comment && (
                  <p className="text-xs mt-1 px-2 py-1.5 rounded-lg" style={{ background: T.card, color: T.textSub }}>
                    <span className="font-semibold" style={{ color: T.text }}>Teacher:</span> {c.teacher_comment}
                  </p>
                )}
                {c.reviewer_name && c.status === 'approved' && (
                  <p className="text-xs mt-1" style={{ color: T.success }}>Approved by {c.reviewer_name}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function StudentWellness() {
  const [chatOpen, setChatOpen] = useState(false);

  const resources = [
    { title: 'Guided Meditation for Focus', duration: '10 min', type: 'Audio' },
    { title: 'Managing Exam Anxiety', duration: '5 min read', type: 'Article' },
    { title: 'Sleep Hygiene Basics', duration: '15 min', type: 'Video' },
  ];

  return (
    <Layout title="Student Wellness">
      <div className="max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left — main */}
          <div className="lg:col-span-2 space-y-5">
            <MoodCard />

            {/* Talk to a counselor */}
            <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={16} style={{ color: T.accent }} />
                <h2 className="text-sm font-semibold" style={{ color: T.text }}>Talk to a Counselor</h2>
              </div>
              <p className="text-xs mb-3" style={{ color: T.textMuted }}>
                A private channel between you and the school's online counselors. Separate from messages and collaboration — only you and the counselor can see it.
              </p>
              <button onClick={() => setChatOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: T.accent, color: '#fff' }}>
                <MessageCircle size={13} /> Open counselor chat
              </button>
            </div>

            <JournalCard />

            <MedicalConditionsCard />
            <MedicalCertificatesCard />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Emergency */}
            <div className="rounded-2xl p-5" style={{ background: '#FFF5F5', border: '1px solid #FED7D7' }}>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: '#FED7D7' }}>
                  <Phone size={18} style={{ color: '#C53030' }} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold mb-1" style={{ color: '#C53030' }}>Immediate Support</h3>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: '#742A2A' }}>
                    If you're in crisis or need immediate help, reach out now.
                  </p>
                  <button className="w-full py-2 rounded-xl text-xs font-semibold" style={{ background: '#C53030', color: '#fff' }}>
                    Call Support Line
                  </button>
                </div>
              </div>
            </div>

            <InfirmaryCard />

            {/* Resources */}
            <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: T.text }}>Wellness Library</h2>
              <div className="space-y-2">
                {resources.map((r, i) => (
                  <button key={i} className="w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors hover:opacity-80">
                    <div className="p-2 rounded-lg shrink-0" style={{ background: T.bgDeep }}>
                      {r.type === 'Audio' ? <Wind size={14} style={{ color: '#7C3AED' }} />
                        : r.type === 'Article' ? <BookOpen size={14} style={{ color: T.warning }} />
                          : <Clock size={14} style={{ color: T.success }} />}
                    </div>
                    <div>
                      <div className="text-xs font-medium" style={{ color: T.text }}>{r.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.textMuted }}>{r.type}</span>
                        <span className="text-xs" style={{ color: T.textMuted }}>· {r.duration}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Counselor chat modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold" style={{ color: '#fff' }}>Counselor Chat</h3>
              <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg" style={{ color: '#fff' }}><X size={16} /></button>
            </div>
            <CounselorChat role="student" />
          </div>
        </div>
      )}
    </Layout>
  );
}
