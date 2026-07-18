import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useApi } from '../../hooks/useApi';
import { API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import {
  ArrowLeft, FolderOpen, FileText, Sparkles, Clock, Plus, Upload,
  Trash2, Send, Bot, Loader, X, CheckCircle2, Circle,
  Maximize2, ChevronLeft, ChevronRight, Download, Eye,
  StickyNote, File as FileIcon,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: number; title: string; description: string; subject: string; status: string;
}
interface ProjectFile {
  id: number; original_name: string; file_type: string; mime_type: string;
  size_bytes: number; is_submitted: boolean; folder: string;
  uploaded_by: string; created_at: string;
}
interface ProjectNote {
  id: number; title: string; content: string; created_at: string; updated_at: string;
}
interface ActivityEntry {
  id: number; user: string; action: string; details: string; created_at: string;
}
interface Slide { index: number; title: string; body: string[]; notes: string; }
interface ConvertResult {
  type: 'pptx' | 'docx' | 'text';
  slides?: Slide[];
  html?: string;
  content?: string;
}

type Tab = 'files' | 'notes' | 'research' | 'activity';
type ViewerState =
  | { kind: 'none' }
  | { kind: 'iframe'; url: string; name: string }
  | { kind: 'slides'; slides: Slide[]; name: string }
  | { kind: 'html_doc'; html: string; name: string }
  | { kind: 'text'; content: string; name: string };

// ── File type helpers ─────────────────────────────────────────────────────────

const FILE_ICON: Record<string, string> = {
  pdf: '📄', html: '🌐', pptx: '📊', docx: '📝', image: '🖼️', text: '📃', other: '📁',
};

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'], ['clean'],
  ],
};

// ════════════════════════════════════════════════════
//  SLIDE VIEWER  (PPTX presentation mode)
// ════════════════════════════════════════════════════

function SlideViewer({ slides, name, onClose }: { slides: Slide[]; name: string; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const slide = slides[idx];

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(slides.length - 1, i + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') { if (fullscreen) setFullscreen(false); else onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const SlideContent = () => (
    <div style={{
      background: '#fff',
      borderRadius: fullscreen ? 0 : '16px',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: fullscreen ? '80px 120px' : '40px 60px',
      boxSizing: 'border-box', position: 'relative',
    }}>
      {/* Slide number */}
      <div style={{ position: 'absolute', top: 20, right: 24, fontSize: 12, color: '#94a3b8' }}>
        {idx + 1} / {slides.length}
      </div>
      {/* Title */}
      <h2 style={{
        fontSize: fullscreen ? '2.5rem' : '1.6rem',
        fontWeight: 700, color: '#1C1917',
        marginBottom: '24px', lineHeight: 1.2,
      }}>{slide.title}</h2>
      {/* Body */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slide.body.map((line, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5', marginTop: 8, flexShrink: 0 }} />
            <span style={{ fontSize: fullscreen ? '1.2rem' : '0.95rem', color: '#374151', lineHeight: 1.6 }}>{line}</span>
          </li>
        ))}
      </ul>
      {/* Notes */}
      {slide.notes && (
        <div style={{
          position: 'absolute', bottom: 20, left: 24, right: 24,
          fontSize: 11, color: '#9ca3af', fontStyle: 'italic',
          borderTop: '1px solid #f3f4f6', paddingTop: 8,
        }}>
          Notes: {slide.notes}
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0f172a', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '1200px', height: '80vh' }}>
            <SlideContent />
          </div>
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px', background: '#1e293b' }}>
          <button onClick={prev} disabled={idx === 0}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{idx + 1} / {slides.length}</span>
          <button onClick={next} disabled={idx === slides.length - 1}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', opacity: idx === slides.length - 1 ? 0.4 : 1 }}>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setFullscreen(false)}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', marginLeft: 32 }}>
            <X size={16} /> Exit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${T.border}`, background: T.bgDeep }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors" style={{ color: T.textMuted }}>
            <ArrowLeft size={15} />
          </button>
          <span className="text-xs font-semibold truncate" style={{ color: T.text }}>{name}</span>
        </div>
        <button onClick={() => setFullscreen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
          style={{ background: T.accent, color: '#fff' }}>
          <Maximize2 size={13} /> Present
        </button>
      </div>

      {/* Slide thumbnails + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail strip */}
        <div className="w-28 overflow-y-auto shrink-0 p-2 space-y-2"
          style={{ background: T.bgDeep, borderRight: `1px solid ${T.border}` }}>
          {slides.map((s, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className="w-full text-left p-2 rounded-lg transition-all"
              style={{
                background: i === idx ? T.accentBg : T.card,
                border: `1px solid ${i === idx ? T.accent : T.border}`,
              }}>
              <div className="text-xs font-bold mb-0.5" style={{ color: i === idx ? T.accent : T.textMuted }}>{i + 1}</div>
              <div className="text-xs truncate leading-tight" style={{ color: T.text }}>{s.title}</div>
            </button>
          ))}
        </div>

        {/* Main slide */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6">
            <SlideContent />
          </div>
          {/* Nav */}
          <div className="flex items-center justify-center gap-4 py-3 shrink-0"
            style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}>
            <button onClick={prev} disabled={idx === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 hover:bg-stone-100"
              style={{ color: T.textSub }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs" style={{ color: T.textMuted }}>{idx + 1} / {slides.length}</span>
            <button onClick={next} disabled={idx === slides.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs disabled:opacity-40 hover:bg-stone-100"
              style={{ color: T.textSub }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
//  MAIN WORKSPACE
// ════════════════════════════════════════════════════

export function StudentProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { request } = useApi();
  const token = localStorage.getItem('academia_token');

  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('files');
  const [viewer, setViewer] = useState<ViewerState>({ kind: 'none' });

  // Files
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Notes
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ProjectNote | null>(null);
  const [noteSaveTimer, setNoteSaveTimer] = useState<ReturnType<typeof setTimeout>>();

  // Research (AI)
  const [researchMessages, setResearchMessages] = useState<{ role: string; content: string }[]>([]);
  const [researchInput, setResearchInput] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const researchEndRef = useRef<HTMLDivElement>(null);

  // Activity
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const pid = Number(projectId);

  // ── Load project & initial data ───────────────────────────────────────────

  useEffect(() => {
    if (!pid) return;
    Promise.all([
      request<Project[]>('/projects').then(list => list.find(p => p.id === pid) ?? null),
      request<ProjectFile[]>(`/projects/${pid}/files`),
      request<ProjectNote[]>(`/projects/${pid}/notes`),
      request<ActivityEntry[]>(`/projects/${pid}/activity`),
    ]).then(([proj, f, n, a]) => {
      setProject(proj);
      setFiles(f);
      setNotes(n);
      if (n.length > 0) setSelectedNote(n[0]);
      setActivity(a);
    }).catch(console.error);
  }, [pid, request]);

  useEffect(() => {
    researchEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [researchMessages]);

  // ── File upload ───────────────────────────────────────────────────────────

  const uploadFiles = useCallback(async (fileList: File[]) => {
    setUploading(true);
    for (const file of fileList) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE}/projects/${pid}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (res.ok) {
          const pf: ProjectFile = await res.json();
          setFiles(prev => [...prev, pf]);
        }
      } catch (e) { console.error(e); }
    }
    setUploading(false);
    // Refresh activity
    request<ActivityEntry[]>(`/projects/${pid}/activity`).then(setActivity).catch(console.error);
  }, [pid, token, request]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // ── File open/view ────────────────────────────────────────────────────────

  const openFile = async (pf: ProjectFile) => {
    const rawUrl = `${API_BASE}/project-files/${pf.id}/raw`;
    const authUrl = `${rawUrl}?token=${token}`;

    if (pf.file_type === 'pdf' || pf.file_type === 'image') {
      setViewer({ kind: 'iframe', url: rawUrl, name: pf.original_name });
    } else if (pf.file_type === 'html') {
      setViewer({ kind: 'iframe', url: rawUrl, name: pf.original_name });
    } else if (pf.file_type === 'pptx' || pf.file_type === 'docx' || pf.file_type === 'text') {
      setConverting(pf.id);
      try {
        const data = await request<ConvertResult>(`/project-files/${pf.id}/convert`);
        if (data.type === 'pptx' && data.slides) {
          setViewer({ kind: 'slides', slides: data.slides, name: pf.original_name });
        } else if (data.type === 'docx' && data.html) {
          setViewer({ kind: 'html_doc', html: data.html, name: pf.original_name });
        } else if (data.type === 'text' && data.content) {
          setViewer({ kind: 'text', content: data.content, name: pf.original_name });
        }
      } catch (e) { console.error(e); } finally { setConverting(null); }
    }
  };

  // ── File actions ──────────────────────────────────────────────────────────

  const toggleSubmit = async (pf: ProjectFile) => {
    const res = await request<{ is_submitted: boolean }>(`/project-files/${pf.id}/submit`, { method: 'PATCH' });
    setFiles(prev => prev.map(f => f.id === pf.id ? { ...f, is_submitted: res.is_submitted } : f));
    request<ActivityEntry[]>(`/projects/${pid}/activity`).then(setActivity).catch(console.error);
  };

  const deleteFile = async (pf: ProjectFile) => {
    if (!confirm(`Delete "${pf.original_name}"?`)) return;
    await request(`/project-files/${pf.id}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.id !== pf.id));
    if (viewer.kind !== 'none' && 'name' in viewer && viewer.name === pf.original_name) {
      setViewer({ kind: 'none' });
    }
  };

  // ── Notes ─────────────────────────────────────────────────────────────────

  const createNote = async () => {
    const note = await request<ProjectNote>(`/projects/${pid}/notes`, {
      method: 'POST',
      body: { title: 'Untitled Note', content: '' },
    });
    setNotes(prev => [note, ...prev]);
    setSelectedNote(note);
    setTab('notes');
    request<ActivityEntry[]>(`/projects/${pid}/activity`).then(setActivity).catch(console.error);
  };

  const saveNote = useCallback((note: ProjectNote, field: 'title' | 'content', value: string) => {
    clearTimeout(noteSaveTimer);
    const timer = setTimeout(async () => {
      await request(`/project-notes/${note.id}`, { method: 'PUT', body: { [field]: value } });
    }, 800);
    setNoteSaveTimer(timer);
  }, [noteSaveTimer, request]);

  const deleteNote = async (note: ProjectNote) => {
    if (!confirm('Delete this note?')) return;
    await request(`/project-notes/${note.id}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== note.id));
    if (selectedNote?.id === note.id) setSelectedNote(notes.find(n => n.id !== note.id) ?? null);
  };

  // ── AI Research ───────────────────────────────────────────────────────────

  const sendResearch = async () => {
    const msg = researchInput.trim();
    if (!msg || researchLoading) return;
    setResearchInput('');
    setResearchMessages(prev => [...prev, { role: 'user', content: msg }]);
    setResearchLoading(true);
    try {
      const data = await request<{ response: string }>(`/projects/${pid}/ai-research`, {
        method: 'POST',
        body: { message: msg, history: researchMessages.map(m => ({ role: m.role, content: m.content })) },
      });
      setResearchMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      request<ActivityEntry[]>(`/projects/${pid}/activity`).then(setActivity).catch(console.error);
    } catch { setResearchMessages(prev => [...prev, { role: 'ai', content: 'AI service unavailable.' }]); }
    finally { setResearchLoading(false); }
  };

  if (!project) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <Loader size={20} className="animate-spin" style={{ color: T.textMuted }} />
    </div>
  );

  const submitted = files.filter(f => f.is_submitted).length;
  const grouped = files.reduce<Record<string, ProjectFile[]>>((acc, f) => {
    const k = f.folder || 'General';
    (acc[k] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg, color: T.text }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ background: T.card, borderBottom: `1px solid ${T.border}`, height: 52 }}>
        <button onClick={() => navigate('/student/projects')}
          className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors" style={{ color: T.textMuted }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate" style={{ color: T.text }}>{project.title}</h1>
          <p className="text-xs truncate" style={{ color: T.textMuted }}>{project.subject || 'No subject'}</p>
        </div>
        <div className="flex items-center gap-2">
          {submitted > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: T.successBg, color: T.success }}>
              {submitted} submitted
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: T.bgDeep, color: T.textMuted, border: `1px solid ${T.border}` }}>
            {project.status}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>
        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 flex flex-col"
          style={{ background: T.bgDeep, borderRight: `1px solid ${T.border}` }}>
          <nav className="p-2 space-y-0.5">
            {([
              { id: 'files',    icon: <FolderOpen size={15} />,  label: 'Files',     badge: files.length },
              { id: 'notes',    icon: <StickyNote size={15} />,  label: 'Notes',     badge: notes.length },
              { id: 'research', icon: <Sparkles size={15} />,    label: 'AI Research', badge: 0 },
              { id: 'activity', icon: <Clock size={15} />,       label: 'History',   badge: 0 },
            ] as { id: Tab; icon: React.ReactNode; label: string; badge: number }[]).map(item => (
              <button key={item.id} onClick={() => { setTab(item.id); setViewer({ kind: 'none' }); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={tab === item.id
                  ? { background: T.accent, color: '#fff' }
                  : { color: T.textSub }}>
                <span style={{ opacity: tab === item.id ? 1 : 0.75 }}>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge > 0 && (
                  <span className="text-xs rounded-full px-1.5"
                    style={{ background: tab === item.id ? 'rgba(255,255,255,0.2)' : T.border, color: tab === item.id ? '#fff' : T.textMuted }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Quick actions */}
          <div className="mt-auto p-2 space-y-1" style={{ borderTop: `1px solid ${T.border}` }}>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:bg-stone-200 transition-colors"
              style={{ color: T.textSub }}>
              <Upload size={13} /> Upload File
              <input type="file" multiple className="hidden" onChange={handleFileInput}
                accept=".pdf,.html,.htm,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.gif,.txt,.md,.csv" />
            </label>
            <button onClick={createNote}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-stone-200 transition-colors"
              style={{ color: T.textSub }}>
              <Plus size={13} /> New Note
            </button>
          </div>
        </aside>

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Viewer overlays the main content */}
          {viewer.kind !== 'none' ? (
            <div className="flex-1 overflow-hidden">
              {viewer.kind === 'iframe' && (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
                    style={{ background: T.bgDeep, borderBottom: `1px solid ${T.border}` }}>
                    <button onClick={() => setViewer({ kind: 'none' })}
                      className="p-1.5 rounded-lg hover:bg-stone-200" style={{ color: T.textMuted }}>
                      <ArrowLeft size={14} />
                    </button>
                    <span className="text-xs font-semibold truncate flex-1" style={{ color: T.text }}>{viewer.name}</span>
                    <a href={viewer.url} download={viewer.name}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs hover:bg-stone-200 transition-colors"
                      style={{ color: T.textSub }}>
                      <Download size={13} /> Download
                    </a>
                  </div>
                  <iframe
                    src={`${viewer.url}${viewer.url.includes('?') ? '&' : '?'}token=${token}`}
                    className="flex-1 border-none w-full"
                    title={viewer.name}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>
              )}

              {viewer.kind === 'slides' && (
                <SlideViewer slides={viewer.slides} name={viewer.name} onClose={() => setViewer({ kind: 'none' })} />
              )}

              {viewer.kind === 'html_doc' && (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
                    style={{ background: T.bgDeep, borderBottom: `1px solid ${T.border}` }}>
                    <button onClick={() => setViewer({ kind: 'none' })}
                      className="p-1.5 rounded-lg hover:bg-stone-200" style={{ color: T.textMuted }}>
                      <ArrowLeft size={14} />
                    </button>
                    <span className="text-xs font-semibold" style={{ color: T.text }}>{viewer.name}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 prose max-w-none"
                    style={{ background: '#fff' }}
                    dangerouslySetInnerHTML={{ __html: viewer.html }} />
                </div>
              )}

              {viewer.kind === 'text' && (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
                    style={{ background: T.bgDeep, borderBottom: `1px solid ${T.border}` }}>
                    <button onClick={() => setViewer({ kind: 'none' })}
                      className="p-1.5 rounded-lg hover:bg-stone-200" style={{ color: T.textMuted }}>
                      <ArrowLeft size={14} />
                    </button>
                    <span className="text-xs font-semibold" style={{ color: T.text }}>{viewer.name}</span>
                  </div>
                  <pre className="flex-1 overflow-auto p-6 text-sm"
                    style={{ background: '#fff', color: T.text, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>
                    {viewer.content}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── FILES TAB ─────────────────────────────────────────── */}
              {tab === 'files' && (
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Drop zone */}
                  <div
                    ref={dropRef}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="mb-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all"
                    style={{
                      border: `2px dashed ${T.border}`, background: T.card,
                      padding: '24px', cursor: 'pointer',
                    }}>
                    {uploading
                      ? <><Loader size={20} className="animate-spin" style={{ color: T.accent }} /><span className="text-xs" style={{ color: T.textMuted }}>Uploading…</span></>
                      : <>
                        <Upload size={20} style={{ color: T.textMuted }} />
                        <span className="text-xs" style={{ color: T.textMuted }}>Drag & drop files here</span>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all hover:opacity-80"
                          style={{ background: T.accent, color: '#fff' }}>
                          <Plus size={13} /> Browse Files
                          <input type="file" multiple className="hidden" onChange={handleFileInput}
                            accept=".pdf,.html,.htm,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.gif,.txt,.md,.csv" />
                        </label>
                      </>
                    }
                  </div>

                  {/* File groups */}
                  {Object.entries(grouped).map(([folder, folderFiles]) => (
                    <div key={folder} className="mb-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                        {folder}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {folderFiles.map(pf => (
                          <div key={pf.id} className="group rounded-2xl p-4 flex flex-col gap-2 relative"
                            style={{ background: T.card, border: `1px solid ${pf.is_submitted ? T.success + '50' : T.border}` }}>
                            {/* Submitted badge */}
                            {pf.is_submitted && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle2 size={14} style={{ color: T.success }} />
                              </div>
                            )}
                            {/* Icon */}
                            <div className="text-2xl">{FILE_ICON[pf.file_type] ?? '📁'}</div>
                            {/* Name */}
                            <div className="text-xs font-semibold leading-tight break-words" style={{ color: T.text }}>
                              {pf.original_name}
                            </div>
                            <div className="text-xs" style={{ color: T.textMuted }}>{humanSize(pf.size_bytes)}</div>
                            {/* Actions */}
                            <div className="flex gap-1 mt-auto flex-wrap">
                              <button
                                onClick={() => openFile(pf)}
                                disabled={converting === pf.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:opacity-80 transition-opacity disabled:opacity-40"
                                style={{ background: T.accentBg, color: T.accent }}>
                                {converting === pf.id ? <Loader size={11} className="animate-spin" /> : <Eye size={11} />}
                                {pf.file_type === 'pptx' ? 'Present' : 'Open'}
                              </button>
                              <button onClick={() => toggleSubmit(pf)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:opacity-80 transition-opacity"
                                style={pf.is_submitted
                                  ? { background: T.successBg, color: T.success }
                                  : { background: T.bgDeep, color: T.textMuted }}>
                                {pf.is_submitted ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                                {pf.is_submitted ? 'Submitted' : 'Submit'}
                              </button>
                              <button onClick={() => deleteFile(pf)}
                                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                style={{ color: T.danger }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {files.length === 0 && !uploading && (
                    <div className="text-center py-12 text-xs" style={{ color: T.textMuted }}>
                      No files yet. Upload a PDF, PPT, Word doc, HTML, or image above.
                    </div>
                  )}
                </div>
              )}

              {/* ── NOTES TAB ─────────────────────────────────────────── */}
              {tab === 'notes' && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Note list */}
                  <div className="w-52 shrink-0 flex flex-col overflow-y-auto"
                    style={{ borderRight: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span className="text-xs font-semibold" style={{ color: T.text }}>Notes</span>
                      <button onClick={createNote} className="p-1 rounded-lg hover:bg-stone-100" style={{ color: T.accent }}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      {notes.map(n => (
                        <div key={n.id} onClick={() => setSelectedNote(n)}
                          className="group flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-colors"
                          style={{
                            background: selectedNote?.id === n.id ? T.bgDeep : 'transparent',
                            border: `1px solid ${selectedNote?.id === n.id ? T.border : 'transparent'}`,
                          }}>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: T.text }}>{n.title || 'Untitled'}</div>
                            <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                              {new Date(n.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteNote(n); }}
                            className="opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                            style={{ color: T.danger }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      {notes.length === 0 && (
                        <p className="text-xs text-center py-6" style={{ color: T.textMuted }}>No notes yet</p>
                      )}
                    </div>
                  </div>

                  {/* Note editor */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedNote ? (
                      <>
                        <input
                          type="text"
                          value={selectedNote.title}
                          onChange={e => {
                            const v = e.target.value;
                            setSelectedNote(p => p ? { ...p, title: v } : null);
                            setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, title: v } : n));
                            saveNote(selectedNote, 'title', v);
                          }}
                          className="text-lg font-bold outline-none px-6 py-4 shrink-0"
                          style={{ background: T.card, color: T.text, borderBottom: `1px solid ${T.border}` }}
                          placeholder="Note title"
                        />
                        <div className="flex-1 overflow-hidden project-quill">
                          <ReactQuill
                            theme="snow"
                            value={selectedNote.content}
                            onChange={v => {
                              setSelectedNote(p => p ? { ...p, content: v } : null);
                              saveNote(selectedNote, 'content', v);
                            }}
                            modules={quillModules}
                            className="h-full"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: T.textMuted }}>
                        <StickyNote size={28} strokeWidth={1.5} />
                        <p className="text-xs">Select a note or create one</p>
                        <button onClick={createNote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: T.accent, color: '#fff' }}>
                          <Plus size={13} /> New Note
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── RESEARCH TAB ──────────────────────────────────────── */}
              {tab === 'research' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {researchMessages.length === 0 && (
                      <div className="text-center py-12">
                        <Sparkles size={28} style={{ color: T.accent }} className="mx-auto mb-3" />
                        <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>AI Research Assistant</p>
                        <p className="text-xs" style={{ color: T.textMuted }}>
                          Ask anything about your project. The AI knows your project title, subject, files, and notes.
                        </p>
                      </div>
                    )}
                    {researchMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 max-w-2xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                          style={msg.role === 'ai' ? { background: T.bgDeep, color: T.accent } : { background: T.accent, color: '#fff' }}>
                          {msg.role === 'ai' ? <Bot size={14} /> : '✦'}
                        </div>
                        <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                          style={msg.role === 'ai'
                            ? { background: T.card, border: `1px solid ${T.border}`, color: T.text }
                            : { background: T.accent, color: '#fff' }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {researchLoading && (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: T.bgDeep }}>
                          <Bot size={14} style={{ color: T.accent }} />
                        </div>
                        <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
                          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textMuted }}>
                          <Loader size={13} className="animate-spin" /> Thinking…
                        </div>
                      </div>
                    )}
                    <div ref={researchEndRef} />
                  </div>
                  <div className="px-5 py-3 shrink-0" style={{ borderTop: `1px solid ${T.border}`, background: T.card }}>
                    <div className="flex items-center gap-2 max-w-3xl">
                      <input type="text" value={researchInput}
                        onChange={e => setResearchInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendResearch()}
                        placeholder="Research, brainstorm, or ask anything about your project…"
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}
                        disabled={researchLoading}
                      />
                      <button onClick={sendResearch} disabled={researchLoading || !researchInput.trim()}
                        className="p-2.5 rounded-xl disabled:opacity-40 hover:opacity-80"
                        style={{ background: T.accent, color: '#fff' }}>
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ACTIVITY TAB ──────────────────────────────────────── */}
              {tab === 'activity' && (
                <div className="flex-1 overflow-y-auto p-5">
                  {activity.length === 0 ? (
                    <div className="text-center py-12 text-xs" style={{ color: T.textMuted }}>
                      No activity yet. Start uploading files or writing notes.
                    </div>
                  ) : (
                    <div className="relative max-w-xl">
                      <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: T.border }} />
                      <div className="space-y-0">
                        {activity.map(log => (
                          <div key={log.id} className="flex items-start gap-4 pb-5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5"
                              style={{ background: T.card, border: `2px solid ${T.border}` }}>
                              <Clock size={13} style={{ color: T.textMuted }} />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold" style={{ color: T.text }}>{log.user}</span>
                                <span className="text-xs" style={{ color: T.textSub }}>{log.action}</span>
                                {log.details && (
                                  <span className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: T.bgDeep, color: T.textMuted }}>{log.details}</span>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                                {new Date(log.created_at).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Quill styles for notes */}
      <style>{`
        .project-quill .ql-container { border: none; font-size: 0.9rem; }
        .project-quill .ql-toolbar { border: none; border-bottom: 1px solid ${T.border}; background: ${T.bgDeep}; padding: 8px 16px; }
        .project-quill .ql-editor { padding: 20px 24px; min-height: 100%; color: ${T.text}; }
        .project-quill .ql-editor.ql-blank::before { color: ${T.textMuted}; font-style: normal; }
      `}</style>
    </div>
  );
}
