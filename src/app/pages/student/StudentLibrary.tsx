import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth, API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import {
  Search, FileText, Video, Image as ImageIcon, Headphones, File,
  Download, ChevronRight, ChevronDown, X, RotateCcw, BookOpen,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  title: string;
  board: string;
  grade: number;          // 0 = no specific grade (competitive / general)
  subject: string;
  chapter: string;
  type: 'pdf' | 'article' | 'video' | 'image' | 'audio' | 'document' | 'ebook' | 'file';
  ext: string;
  mime: string;
  path: string;           // relative path under library_assets/
  size: number;
}

interface LibraryProfile { grade: number; board: string; }

// ── Display config ────────────────────────────────────────────────────────────

const BOARD_ORDER = ['CBSE', 'ICSE', 'ISC', 'IB', 'IGCSE', 'Competitive', 'Unsorted'];

const TYPE_ICON: Record<Resource['type'], React.ReactNode> = {
  pdf:      <FileText size={16} style={{ color: '#DC2626' }} />,
  article:  <FileText size={16} style={{ color: '#2563EB' }} />,
  video:    <Video size={16} style={{ color: '#7C3AED' }} />,
  image:    <ImageIcon size={16} style={{ color: '#0EA5E9' }} />,
  audio:    <Headphones size={16} style={{ color: '#D97706' }} />,
  document: <File size={16} style={{ color: '#059669' }} />,
  ebook:    <BookOpen size={16} style={{ color: '#7C3AED' }} />,
  file:     <File size={16} style={{ color: T.textMuted }} />,
};

const TYPE_LABEL: Record<Resource['type'], string> = {
  pdf: 'PDF', article: 'Article', video: 'Video', image: 'Image',
  audio: 'Audio', document: 'Document', ebook: 'eBook', file: 'File',
};

const gradeLabel = (g: number) => g === 0 ? 'General' : `Class ${g}`;

function fmtSize(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const selectCls =
  'px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const selectStyle: React.CSSProperties = {
  background: T.bgDeep,
  border: `1px solid ${T.border}`,
  color: T.text,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentLibrary() {
  const { request } = useApi();
  const { token } = useAuth();
  const [data, setData] = useState<Resource[]>([]);
  const [profile, setProfile] = useState<LibraryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [board, setBoard] = useState<string>('');
  const [grade, setGrade] = useState<number | ''>('');
  const [subject, setSubject] = useState<string>('All');
  const [search, setSearch] = useState('');

  const [viewer, setViewer] = useState<Resource | null>(null);

  // ── Load catalog + profile ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      request<Resource[]>('/library'),
      request<LibraryProfile>('/students/me/library-profile').catch(() => null),
    ])
      .then(([lib, prof]) => {
        if (cancelled) return;
        setData(lib);
        if (prof) {
          setProfile(prof);
          setBoard(prof.board);
          setGrade(prof.grade);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [request]);

  // ── Derived filter options ──────────────────────────────────────────────────
  const boards = useMemo(() => {
    const set = new Set(data.map(r => r.board));
    return BOARD_ORDER.filter(b => set.has(b)).concat(
      [...set].filter(b => !BOARD_ORDER.includes(b)).sort()
    );
  }, [data]);

  const grades = useMemo(() => {
    const set = new Set(data.filter(r => r.board === board).map(r => r.grade));
    return [...set].sort((a, b) => a - b);
  }, [data, board]);

  const subjects = useMemo(() => {
    const set = new Set(
      data.filter(r => r.board === board && r.grade === grade).map(r => r.subject)
    );
    return [...set].sort();
  }, [data, board, grade]);

  // Clamp selections when the option set changes (e.g. board switch).
  useEffect(() => {
    if (board && !grades.includes(grade as number)) {
      setGrade(grades.length ? grades[0] : '');
      setSubject('All');
    }
  }, [board, grades, grade]);

  useEffect(() => {
    if (subject !== 'All' && !subjects.includes(subject)) setSubject('All');
  }, [subjects, subject]);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(r =>
      r.board === board &&
      r.grade === grade &&
      (subject === 'All' || r.subject === subject) &&
      (!q ||
        r.title.toLowerCase().includes(q) ||
        r.chapter.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q))
    );
  }, [data, board, grade, subject, search]);

  const grouped = useMemo(() => {
    const bySubject = new Map<string, Map<string, Resource[]>>();
    for (const r of filtered) {
      if (!bySubject.has(r.subject)) bySubject.set(r.subject, new Map());
      const byChapter = bySubject.get(r.subject)!;
      if (!byChapter.has(r.chapter)) byChapter.set(r.chapter, []);
      byChapter.get(r.chapter)!.push(r);
    }
    return bySubject;
  }, [filtered]);

  const resetToProfile = () => {
    if (profile) { setBoard(profile.board); setGrade(profile.grade); setSubject('All'); }
    setSearch('');
  };

  // ── Empty-state hint when the library has no files yet ──────────────────────
  const libraryEmpty = !loading && data.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout title="Resource Library">
      <div className="max-w-6xl space-y-5">
        {/* Filter bar */}
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Board">
              <select value={board} onChange={e => { setBoard(e.target.value); setSubject('All'); }}
                className={selectCls} style={selectStyle}>
                {boards.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Grade">
              <select value={grade} onChange={e => setGrade(Number(e.target.value))}
                className={selectCls} style={selectStyle} disabled={!grades.length}>
                {grades.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className={selectCls} style={selectStyle} disabled={!subjects.length}>
                <option value="All">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3.5 top-3"
                style={{ color: T.textMuted }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chapters or titles…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            {profile && (
              <button onClick={resetToProfile}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl hover:opacity-70 transition-opacity"
                style={{ background: T.bgDeep, color: T.textSub }}>
                <RotateCcw size={13} /> My grade
              </button>
            )}
          </div>
          <div className="text-xs" style={{ color: T.textMuted }}>
            {loading ? 'Loading…' :
              <><span style={{ color: T.textSub, fontWeight: 500 }}>{filtered.length}</span> resources
                {profile && <> · showing <span style={{ color: T.textSub }}>{board}</span> · {gradeLabel(grade as number)}</>}</>}
          </div>
        </div>

        {/* Empty library — tell the admin where to drop files */}
        {libraryEmpty && (
          <div className="rounded-2xl p-8 text-center" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="inline-flex p-3 rounded-2xl mb-3" style={{ background: T.bgDeep }}>
              <BookOpen size={24} style={{ color: T.textMuted }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: T.text }}>No resources yet</h3>
            <p className="text-xs max-w-md mx-auto" style={{ color: T.textMuted }}>
              Add content to <code style={{ background: T.bgDeep, padding: '1px 5px', borderRadius: 4 }}>
              backend/library_assets/&lt;Board&gt;/&lt;Class N&gt;/&lt;Subject&gt;/&lt;Chapter&gt;/</code>
              {' '}and it will appear here automatically. See the README in that folder.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 rounded-2xl" style={{ background: T.bgDeep }} />)}
          </div>
        )}

        {/* No matches (library has files, filters exclude all) */}
        {!loading && !libraryEmpty && filtered.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: T.textMuted }}>
            No resources match these filters.
          </div>
        )}

        {/* Results */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-6">
            {[...grouped.entries()].map(([subj, chapters]) => (
              <SubjectSection key={subj} subject={subj} chapters={chapters} onOpen={setViewer} />
            ))}
          </div>
        )}
      </div>

      {viewer && (
        <ResourceViewer resource={viewer} token={token} onClose={() => setViewer(null)} />
      )}
    </Layout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: T.textMuted }}>{label}</span>
      {children}
    </label>
  );
}

function SubjectSection({
  subject, chapters, onOpen,
}: {
  subject: string;
  chapters: Map<string, Resource[]>;
  onOpen: (r: Resource) => void;
}) {
  const [open, setOpen] = useState(true);
  const chapterList = [...chapters.entries()];
  return (
    <section className="rounded-2xl" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
        <span className="flex items-center gap-2.5">
          <ChevronDown size={16} style={{ color: T.textMuted,
            transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          <span className="text-sm font-semibold" style={{ color: T.text }}>{subject}</span>
        </span>
        <span className="text-xs" style={{ color: T.textMuted }}>
          {chapterList.length} chapters
        </span>
      </button>
      {open && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {chapterList.map(([chapter, resources]) => (
            <ChapterCard key={chapter} chapter={chapter} resources={resources} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChapterCard({
  chapter, resources, onOpen,
}: {
  chapter: string;
  resources: Resource[];
  onOpen: (r: Resource) => void;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
      <h4 className="text-sm font-semibold mb-3 leading-snug" style={{ color: T.text }}>{chapter}</h4>
      <div className="space-y-2">
        {resources.map(r => (
          <button key={r.id} onClick={() => onOpen(r)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <span className="shrink-0">{TYPE_ICON[r.type]}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate" style={{ color: T.text }}>{r.title}</span>
              <span className="block text-[11px] truncate" style={{ color: T.textMuted }}>
                {TYPE_LABEL[r.type]}{r.ext ? ` · ${r.ext.toUpperCase()}` : ''}{r.size ? ` · ${fmtSize(r.size)}` : ''}
              </span>
            </span>
            <ChevronRight size={14} style={{ color: T.textMuted }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── In-app viewer ─────────────────────────────────────────────────────────────

function assetUrl(path: string, token: string | null): string {
  const params = new URLSearchParams();
  params.set('p', path);
  if (token) params.set('token', token);
  return `${API_BASE}/library/asset?${params.toString()}`;
}

function ResourceViewer({
  resource, token, onClose,
}: {
  resource: Resource;
  token: string | null;
  onClose: () => void;
}) {
  const src = useMemo(() => assetUrl(resource.path, token), [resource.path, token]);
  const downloadable = resource.type === 'document' || resource.type === 'ebook' || resource.type === 'file';

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: T.bg }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0 gap-4"
        style={{ background: T.card, borderBottom: `1px solid ${T.border}`, height: '56px' }}>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70 transition-opacity"
          style={{ color: T.textSub }}>
          <X size={16} /> Close
        </button>
        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-sm font-semibold truncate" style={{ color: T.text }}>{resource.title}</h1>
          <p className="text-[11px] truncate" style={{ color: T.textMuted }}>
            {resource.subject} · {resource.chapter} · {TYPE_LABEL[resource.type]}
          </p>
        </div>
        <a href={src} download={resource.title}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
          style={{ background: T.accent, color: T.accentText }}>
          <Download size={13} /> Download
        </a>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(resource.type === 'pdf' || resource.type === 'article') && (
          <iframe src={src} className="w-full h-full border-none" title={resource.title} />
        )}
        {resource.type === 'video' && (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#000' }}>
            <video src={src} controls className="max-w-full max-h-full" />
          </div>
        )}
        {resource.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center p-6" style={{ background: T.bgDeep }}>
            <img src={src} alt={resource.title} className="max-w-full max-h-full rounded-lg"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
          </div>
        )}
        {resource.type === 'audio' && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-5 p-6">
            <Headphones size={40} style={{ color: T.textMuted }} />
            <audio src={src} controls />
          </div>
        )}
        {downloadable && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 max-w-sm mx-auto text-center px-6">
            <div className="p-4 rounded-2xl" style={{ background: T.bgDeep }}>
              <File size={28} style={{ color: T.textMuted }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: T.text }}>{resource.title}</h3>
              <p className="text-xs" style={{ color: T.textMuted }}>
                {TYPE_LABEL[resource.type]} · {resource.ext.toUpperCase()} · {fmtSize(resource.size)}
              </p>
            </div>
            <a href={src} download={resource.title}
              className="px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
              style={{ background: T.accent, color: T.accentText }}>
              <Download size={15} /> Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
