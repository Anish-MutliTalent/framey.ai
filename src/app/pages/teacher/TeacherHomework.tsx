import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import {
  BookOpen, BookMarked, ChevronLeft, ChevronRight,
  Save, AlertTriangle, CheckCircle2, Plus, Trash2,
  Paperclip, Upload, Download, X,
} from 'lucide-react';

interface MySection {
  section_id: number;
  section_name: string;
  subjects: { id: number; name: string; color: string }[];
}

interface HomeworkEntry {
  id: number;
  section_id: number;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  section_name: string;
  date: string;
  classwork_title?: string;
  classwork_description?: string;
  homework_title?: string;
  homework_description?: string;
  homework_due_date?: string;
  updated_at?: string;
  files?: { id: number; original_name: string; file_type: string; size_bytes: number }[];
}

interface HwFile {
  id: number; original_name: string; file_type: string; size_bytes: number;
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function shiftDate(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

const CARD_STYLE = {
  background: T.card,
  border: `1px solid ${T.border}`,
};

// ── Defined outside so it keeps a stable reference across re-renders ─────────
function LabeledField({ label, value, onChange, placeholder = '', rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
        style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
    </div>
  );
}

// ── EntryCard — defined outside so it keeps stable reference ─────────────────
function EntryCard({
  entry, token, onDelete, onFileUploaded, onFileDeleted,
}: {
  entry: HomeworkEntry;
  token: string | null;
  onDelete: (id: number) => void;
  onFileUploaded: (entryId: number, file: HwFile) => void;
  onFileDeleted: (entryId: number, fileId: number) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/homework/entry/${entry.id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const data: HwFile = await res.json();
        onFileUploaded(entry.id, data);
      }
    } finally { setUploading(false); e.target.value = ''; }
  };

  const deleteFile = async (fileId: number) => {
    await fetch(`${API_BASE}/homework/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    onFileDeleted(entry.id, fileId);
  };

  return (
    <div className="rounded-2xl overflow-hidden group" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: entry.subject_color }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: T.text }}>
                {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${entry.subject_color}15`, color: entry.subject_color }}>
                {entry.subject_name}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              {entry.classwork_title && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: T.textSub }}>
                  <BookOpen size={11} style={{ color: T.info }} />
                  <span>{entry.classwork_title}</span>
                </div>
              )}
              {entry.homework_title && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: T.textSub }}>
                  <BookMarked size={11} style={{ color: T.warning }} />
                  <span>{entry.homework_title}</span>
                  {entry.homework_due_date && (
                    <span style={{ color: T.textMuted }}>
                      · due {new Date(entry.homework_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Upload button */}
          <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-stone-100 transition-colors"
            style={{ color: T.textSub }}>
            {uploading
              ? <span className="text-xs" style={{ color: T.textMuted }}>Uploading…</span>
              : <><Paperclip size={12} /> Attach</>}
            <input type="file" className="hidden" onChange={uploadFile}
              accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt" />
          </label>
          <button onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
            style={{ color: T.danger }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Attached files */}
      {(entry.files ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3 pt-0"
          style={{ borderTop: `1px solid ${T.border}` }}>
          <span className="w-full text-xs pt-2" style={{ color: T.textMuted }}>
            <Paperclip size={10} className="inline mr-1" />Attachments
          </span>
          {(entry.files ?? []).map(f => (
            <div key={f.id} className="flex items-center gap-1 rounded-xl overflow-hidden"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
              <a href={`${API_BASE}/homework/files/${f.id}/raw`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs hover:opacity-70 transition-opacity"
                style={{ color: T.textSub }}>
                <Download size={11} /> {f.original_name}
              </a>
              <button onClick={() => deleteFile(f.id)}
                className="px-2 py-1.5 hover:bg-red-50 transition-colors border-l"
                style={{ color: T.danger, borderColor: T.border }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeacherHomework() {
  const { request } = useApi();
  const token = localStorage.getItem('academia_token');

  const [sections, setSections] = useState<MySection[]>([]);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Subject for current form — auto-select first subject of section
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [subjectWarning, setSubjectWarning] = useState(false);

  // Form state
  const [cwTitle, setCwTitle] = useState('');
  const [cwDesc, setCwDesc] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState('');

  // Existing entries for the selected section (all dates)
  const [entries, setEntries] = useState<HomeworkEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Files chosen before saving — uploaded immediately after the entry is created
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Fetch teacher's sections
  useEffect(() => {
    request<MySection[]>('/teachers/my-sections').then(s => {
      setSections(s);
      if (s.length > 0) {
        setSelectedSection(s[0].section_id);
        setSelectedSubject(s[0].subjects[0]?.id ?? null);
      }
    }).catch(console.error);
  }, [request]);

  // Fetch existing entries when section changes
  useEffect(() => {
    if (!selectedSection) return;
    setLoading(true);
    request<HomeworkEntry[]>(`/homework/section/${selectedSection}`)
      .then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, [selectedSection, request]);

  // Auto-select subject when section or date changes; prefill form from existing entry
  useEffect(() => {
    if (!selectedSection || !selectedSubject) return;
    const dateStr = fmtDate(selectedDate);
    const existing = entries.find(
      e => e.section_id === selectedSection && e.subject_id === selectedSubject && e.date === dateStr
    );
    if (existing) {
      setCwTitle(existing.classwork_title ?? '');
      setCwDesc(existing.classwork_description ?? '');
      setHwTitle(existing.homework_title ?? '');
      setHwDesc(existing.homework_description ?? '');
      setHwDue(existing.homework_due_date ? existing.homework_due_date.slice(0, 10) : '');
    } else {
      setCwTitle(''); setCwDesc(''); setHwTitle(''); setHwDesc(''); setHwDue('');
    }
    setSubjectWarning(false);
  }, [selectedSection, selectedSubject, selectedDate, entries]);

  const currentSection = sections.find(s => s.section_id === selectedSection);
  const ownSubjectIds = new Set(currentSection?.subjects.map(s => s.id) ?? []);

  const handleSubjectChange = (id: number) => {
    setSelectedSubject(id);
    setSubjectWarning(!ownSubjectIds.has(id));
  };

  const save = async (type: 'classwork' | 'homework' | 'both') => {
    if (!selectedSection || !selectedSubject) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      section_id: selectedSection,
      subject_id: selectedSubject,
      date: fmtDate(selectedDate),
    };
    if (type === 'classwork' || type === 'both') {
      payload.classwork_title = cwTitle || null;
      payload.classwork_description = cwDesc || null;
    }
    if (type === 'homework' || type === 'both') {
      payload.homework_title = hwTitle || null;
      payload.homework_description = hwDesc || null;
      payload.homework_due_date = hwDue || null;
    }
    try {
      const updated = await request<HomeworkEntry>('/homework/entry', { method: 'POST', body: payload });

      // Upload any pending files now that we have the entry id
      const uploadedFiles: HwFile[] = [...(updated.files ?? [])];
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/homework/entry/${updated.id}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (res.ok) uploadedFiles.push(await res.json() as HwFile);
      }
      setPendingFiles([]);

      const withFiles = { ...updated, files: uploadedFiles };
      setEntries(prev => {
        const idx = prev.findIndex(e => e.id === updated.id);
        return idx >= 0 ? prev.map(e => e.id === updated.id ? withFiles : e) : [withFiles, ...prev];
      });

      setSavedMsg(type === 'classwork' ? 'Classwork saved!' : type === 'homework' ? 'Homework saved!' : 'Saved!');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const deleteEntry = async (entryId: number) => {
    if (!confirm('Delete this entry? Students will lose it from their diary.')) return;
    await request(`/homework/entry/${entryId}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  // Group entries by date for the history view
  const recentEntries = entries.slice(0, 20);

  return (
    <Layout title="Homework & Classwork">
      <div className="max-w-4xl space-y-5">

        {/* ── Top controls ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Section */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Section</label>
            <select
              value={selectedSection ?? ''}
              onChange={e => {
                const sid = Number(e.target.value);
                setSelectedSection(sid);
                const sec = sections.find(s => s.section_id === sid);
                setSelectedSubject(sec?.subjects[0]?.id ?? null);
              }}
              className="px-3 py-2 rounded-xl text-sm outline-none appearance-none"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}>
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
            </select>
          </div>

          {/* Date navigator */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Date</label>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <button onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                className="px-3 py-2 hover:bg-stone-100 transition-colors" style={{ color: T.textMuted }}>
                <ChevronLeft size={15} />
              </button>
              <input type="date" value={fmtDate(selectedDate)}
                onChange={e => setSelectedDate(new Date(e.target.value))}
                className="px-2 py-2 text-sm outline-none"
                style={{ background: T.card, color: T.text }} />
              <button onClick={() => setSelectedDate(d => shiftDate(d, 1))}
                className="px-3 py-2 hover:bg-stone-100 transition-colors" style={{ color: T.textMuted }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className="flex-1 min-w-48">
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Subject</label>
            <div>
              <select
                value={selectedSubject ?? ''}
                onChange={e => handleSubjectChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none appearance-none"
                style={{
                  background: T.bgDeep,
                  border: `1px solid ${subjectWarning ? T.warning : T.border}`,
                  color: T.text,
                }}>
                {currentSection?.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {/* Show all school subjects if they want to override */}
              </select>
              {subjectWarning && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs"
                  style={{ color: T.warning }}>
                  <AlertTriangle size={12} />
                  This is not your assigned subject for this section.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Entry cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Classwork card */}
          <div className="rounded-2xl p-5 space-y-4" style={CARD_STYLE}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl" style={{ background: `${T.info}12` }}>
                <BookOpen size={16} style={{ color: T.info }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: T.text }}>Classwork</h3>
                <p className="text-xs" style={{ color: T.textMuted }}>What was done in class today</p>
              </div>
            </div>
            <LabeledField label="Title" value={cwTitle} onChange={setCwTitle}
              placeholder="e.g. Chapter 3 — Fractions" rows={1} />
            <LabeledField label="Description" value={cwDesc} onChange={setCwDesc}
              placeholder="Notes, exercises covered, key concepts…" rows={4} />
            <button onClick={() => save('classwork')} disabled={saving || !cwTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-full justify-center transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: T.info, color: '#fff' }}>
              <Save size={13} /> Save Classwork
            </button>
          </div>

          {/* Homework card */}
          <div className="rounded-2xl p-5 space-y-4" style={CARD_STYLE}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl" style={{ background: `${T.warning}12` }}>
                <BookMarked size={16} style={{ color: T.warning }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: T.text }}>Homework</h3>
                <p className="text-xs" style={{ color: T.textMuted }}>Task for students to complete at home</p>
              </div>
            </div>
            <LabeledField label="Title" value={hwTitle} onChange={setHwTitle}
              placeholder="e.g. Exercise 3.4 (Q1–10)" rows={1} />
            <LabeledField label="Description" value={hwDesc} onChange={setHwDesc}
              placeholder="What exactly to do, page numbers, instructions…" rows={3} />
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Due Date (optional)</label>
              <input type="date" value={hwDue} onChange={e => setHwDue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <button onClick={() => save('homework')} disabled={saving || !hwTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-full justify-center transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: T.warning, color: '#fff' }}>
              <Save size={13} /> Save Homework
            </button>
          </div>
        </div>

        {/* ── File attachment picker ──────────────────────────────────────────── */}
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: T.textSub }}>
              <Paperclip size={12} className="inline mr-1" />
              Attachments {pendingFiles.length > 0 && `(${pendingFiles.length} pending)`}
            </span>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
              <Upload size={12} /> Add Files
              <input type="file" multiple className="hidden"
                accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt,.md"
                onChange={e => {
                  if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }} />
            </label>
          </div>

          {pendingFiles.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: T.textMuted }}>
              Add PDFs, Word docs, PowerPoints, or images — they'll be uploaded when you save.
            </p>
          )}

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 rounded-xl overflow-hidden"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <span className="text-xs px-2.5 py-1.5" style={{ color: T.textSub }}>
                    {f.name}
                  </span>
                  <button
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                    className="px-2 py-1.5 hover:bg-red-50 transition-colors border-l"
                    style={{ color: T.danger, borderColor: T.border }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save both + status */}
        <div className="flex items-center gap-3">
          <button onClick={() => save('both')}
            disabled={saving || (!cwTitle.trim() && !hwTitle.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: T.accent, color: '#fff' }}>
            {saving
              ? 'Saving…'
              : <><Plus size={14} /> Save{pendingFiles.length > 0 ? ` & Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}` : ' Both'}</>}
          </button>
          {savedMsg && (
            <span className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: T.success }}>
              <CheckCircle2 size={14} /> {savedMsg}
            </span>
          )}
        </div>

        {/* ── Recent entries history ────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: T.text }}>Recent Entries</h2>
          {loading && <div className="animate-pulse space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl" style={{ background: T.bgDeep }} />)}
          </div>}
          {!loading && recentEntries.length === 0 && (
            <p className="text-xs py-6 text-center" style={{ color: T.textMuted }}>
              No entries yet. Fill in classwork or homework above and save.
            </p>
          )}
          <div className="space-y-3">
            {recentEntries.map(e => (
              <EntryCard
                key={e.id}
                entry={e}
                token={token}
                onDelete={deleteEntry}
                onFileUploaded={(entryId, file) => {
                  setEntries(prev => prev.map(x =>
                    x.id === entryId
                      ? { ...x, files: [...(x.files ?? []), file] }
                      : x
                  ));
                }}
                onFileDeleted={(entryId, fileId) => {
                  setEntries(prev => prev.map(x =>
                    x.id === entryId
                      ? { ...x, files: (x.files ?? []).filter(f => f.id !== fileId) }
                      : x
                  ));
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
