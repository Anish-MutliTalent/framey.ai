import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../erp/Layout';
import { Skeleton } from '../erp/UI';
import { RenderText } from '../erp/RenderText';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import {
  useFileUrl, useSubmissionFileUrl, SubmissionsPanel,
  type ClassroomPost, type PostFile,
} from './parts';
import {
  ArrowLeft, Send, Paperclip, ClipboardList, BookOpen, Calendar,
  CheckCircle2, Clock, AlertCircle, Upload, FileText, Plus,
} from 'lucide-react';

interface ProjectFile { id: number; original_name: string; file_type?: string; mime_type?: string; is_submitted?: boolean; }
interface MySubmission {
  id: number;
  content?: string | null;
  submitted_at?: string | null;
  marks_obtained?: number | null;
  feedback?: string | null;
  marked_done?: boolean;
  project?: { id: number; title: string; files: ProjectFile[] } | null;
  files: { id: number; original_name: string; mime_type?: string; size_bytes: number }[];
}
interface PrivateComment {
  id: number;
  author: { id: number; name: string; avatar_url?: string };
  student?: { id: number; name: string } | null;
  content: string;
  created_at: string;
}
interface Project { id: number; title: string; }

function statusFor(post: ClassroomPost, sub: MySubmission | null): { label: string; color: string; icon: React.ElementType } {
  if (sub && ((sub.content && sub.content.trim()) || (sub.files && sub.files.length > 0) || sub.project)) {
    return { label: 'Turned In', color: T.success, icon: CheckCircle2 };
  }
  if (sub?.marked_done) return { label: 'Marked Done', color: T.info, icon: CheckCircle2 };
  const due = post.assignment?.due_date;
  if (due && new Date(due) < new Date()) return { label: 'Missing', color: T.danger, icon: AlertCircle };
  return { label: 'Due', color: T.warning, icon: Clock };
}

// ── Attachment preview (image thumbnail or file chip) ─────────────────────────

function AttachmentPreview({ f, fileUrl }: { f: PostFile; fileUrl: (id: number) => string }) {
  const isImage = f.file_type === 'image' || (f.mime_type || '').startsWith('image/');
  if (isImage) {
    return (
      <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
        <img src={fileUrl(f.id)} alt={f.original_name} className="w-32 h-32 object-cover" />
      </a>
    );
  }
  return (
    <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer"
      className="flex flex-col items-center justify-center w-32 h-32 rounded-xl gap-1 px-2 text-center hover:opacity-80"
      style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
      <FileText size={22} style={{ color: T.textSub }} />
      <span className="text-xs font-medium truncate w-full" style={{ color: T.textSub }}>{f.original_name}</span>
    </a>
  );
}

// ── Left details (title, due, points, instructions, attachments, class comments) ──

function LeftDetails({ post, onBack }: { post: ClassroomPost; onBack: () => void }) {
  const { request } = useApi();
  const fileUrl = useFileUrl();
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [comments, setComments] = useState<PostFile[] | any[]>(post.comments ?? []);

  const isAssignment = post.post_type === 'assignment';
  const isMaterial = post.post_type === 'material';
  const Icon = isAssignment ? ClipboardList : isMaterial ? BookOpen : FileText;
  const iconBg = isAssignment ? T.warningBg : isMaterial ? T.successBg : T.infoBg;
  const iconColor = isAssignment ? T.warning : isMaterial ? T.success : T.info;
  const due = post.assignment?.due_date;
  const points = post.assignment?.max_marks ?? 0;

  const submitReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      const c = await request<any>(`/classroom/posts/${post.id}/comments`, { method: 'POST', body: { content: replyText.trim() } });
      setReplyText('');
      setComments(prev => [...prev, c]);
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed');
    } finally { setPosting(false); }
  };

  return (
    <>
      <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors shrink-0" style={{ color: T.textMuted }}>
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: iconBg, color: iconColor }}>
            <Icon size={18} />
          </div>
          <h1 className="text-base font-bold" style={{ color: T.text }}>{post.title || 'Untitled'}</h1>
          {isAssignment && due && (
            <span className="text-xs flex items-center gap-1" style={{ color: T.warning }}>
              <Calendar size={11} /> Due {new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {isAssignment && points > 0 && (
            <span className="text-xs" style={{ color: T.textMuted }}>{points} points</span>
          )}
        </div>
        <hr className="my-4" style={{ border: 'none', borderTop: `1px solid ${T.border}` }} />
        {post.content ? (
          <RenderText text={post.content} tag="div" className="text-sm leading-relaxed" style={{ color: T.textSub }} />
        ) : (
          <p className="text-sm" style={{ color: T.textMuted }}>No instructions.</p>
        )}
        {post.files && post.files.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>Attachments</p>
            <div className="flex flex-wrap gap-3">
              {post.files.map(f => <AttachmentPreview key={f.id} f={f} fileUrl={fileUrl} />)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>Class comments</p>
        <div className="space-y-3 mb-4">
          {comments.length === 0 && <p className="text-xs" style={{ color: T.textMuted }}>No comments yet.</p>}
          {comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: T.bgDeep, color: T.textSub }}>
                {c.author?.name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: T.text }}>{c.author?.name}</span>
                  <span className="text-xs" style={{ color: T.textMuted }}>
                    {new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitReply()}
            placeholder="Add class comment…"
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
          <button onClick={submitReply} disabled={posting || !replyText.trim()}
            className="p-2 rounded-xl disabled:opacity-40 hover:opacity-80" style={{ background: T.accent, color: '#fff' }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Student "Your Work" card (with project picker) ────────────────────────────

function StudentWorkCard({ post }: { post: ClassroomPost }) {
  const { request } = useApi();
  const submissionFileUrl = useSubmissionFileUrl();
  const assignmentId = post.assignment!.id;
  const [sub, setSub] = useState<MySubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [data, proj] = await Promise.all([
        request<MySubmission | null>(`/classroom/assignments/${assignmentId}/my-submission`),
        request<Project[]>('/projects').catch(() => [] as Project[]),
      ]);
      setSub(data ?? null);
      setProjects(proj);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [assignmentId]);

  const submitWork = async () => {
    if (submitting) return;
    if (!file && !projectId) { setError('Attach a file or a project.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (projectId) fd.append('project_id', projectId);
      await request(`/classroom/assignments/${assignmentId}/submit`, { method: 'POST', body: fd });
      setFile(null); setProjectId(''); setShowForm(false);
      await load();
    } catch (e) {
      setError((e instanceof Error ? e : new Error(String(e))).message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const markDone = async () => {
    try {
      await request(`/classroom/assignments/${assignmentId}/mark-done`, { method: 'POST' });
      await load();
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed');
    }
  };

  const status = statusFor(post, sub);
  const StatusIcon = status.icon;

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: T.text }}>Your Work</span>
        {!loading && (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: status.color }}>
            <StatusIcon size={13} /> {status.label}
          </span>
        )}
      </div>

      {loading ? <Skeleton /> : (
        <>
          {sub?.project && (
            <div className="px-2.5 py-2 rounded-xl text-xs flex items-center gap-1.5" style={{ background: T.bgDeep, color: T.info }}>
              <FileText size={12} /> Project: {sub.project.title}
            </div>
          )}
          {sub?.content && (
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{sub.content}</p>
          )}
          {sub?.files && sub.files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sub.files.map(f => (
                <a key={f.id} href={submissionFileUrl(f.id)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: T.bgDeep, color: T.textSub }}>
                  <Paperclip size={10} /> {f.original_name}
                </a>
              ))}
            </div>
          )}

          {showForm ? (
            <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              {projects.length > 0 && (
                <div>
                  <label className="text-xs block mb-1" style={{ color: T.textMuted }}>Or attach a project</label>
                  <select value={projectId} onChange={e => setProjectId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs outline-none"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}>
                    <option value="">— Select a project —</option>
                    {projects.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs cursor-pointer hover:opacity-80 w-fit"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                <Upload size={12} /> {file ? file.name : 'Add file'}
                <input type="file" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ''; }} />
              </label>
              {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={submitWork} disabled={submitting}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40" style={{ background: T.accent, color: '#fff' }}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
                <button onClick={() => { setShowForm(false); setError(''); }}
                  className="px-3 py-1.5 rounded-xl text-xs" style={{ color: T.textMuted }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:opacity-80"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                <Plus /> Add
              </button>
              <button disabled title="Available after Google Authentication migration"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium opacity-50 cursor-not-allowed"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                <Plus /> Create
              </button>
              <button onClick={markDone}
                className="px-3 py-1.5 rounded-xl text-xs font-medium hover:opacity-80"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: sub?.marked_done ? T.info : T.textSub }}>
                {sub?.marked_done ? 'Marked done ✓' : 'Mark as done'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Private comments card ─────────────────────────────────────────────────────

function PrivateCommentsCard({ post, teacherName, studentId }: { post: ClassroomPost; teacherName: string; studentId?: number }) {
  const { request } = useApi();
  const [comments, setComments] = useState<PrivateComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const path = studentId
        ? `/classroom/posts/${post.id}/private-comments?student_id=${studentId}`
        : `/classroom/posts/${post.id}/private-comments`;
      const data = await request<PrivateComment[]>(path);
      setComments(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [post.id, studentId]);

  const send = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const body: any = { content: text.trim() };
      if (studentId) body.student_id = studentId;
      await request(`/classroom/posts/${post.id}/private-comments`, { method: 'POST', body });
      setText('');
      await load();
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed');
    } finally { setPosting(false); }
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <span className="text-sm font-semibold" style={{ color: T.text }}>Private comments</span>
      {loading ? <Skeleton /> : (
        <div className="space-y-2.5">
          {comments.length === 0 && <p className="text-xs" style={{ color: T.textMuted }}>No private comments yet.</p>}
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: T.bgDeep, color: T.textSub }}>
                {c.author.name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: T.text }}>{c.author.name}</span>
                  <span className="text-xs" style={{ color: T.textMuted }}>
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
        <input type="text" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`Add comment to ${teacherName}…`}
          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
        <button onClick={send} disabled={posting || !text.trim()}
          className="p-2 rounded-xl disabled:opacity-40 hover:opacity-80" style={{ background: T.accent, color: '#fff' }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Teacher: Student work tab ─────────────────────────────────────────────────

interface StudentRow {
  student: { id: number; name: string; roll_number?: string; avatar_url?: string };
  status: string;
  submission: MySubmission | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  turned_in: { label: 'Turned In', color: T.success },
  marked_done: { label: 'Marked Done', color: T.info },
  missing: { label: 'Missing', color: T.danger },
  due: { label: 'Due', color: T.warning },
};

function StudentWorkTab({ post, postId }: { post: ClassroomPost; postId: string }) {
  const navigate = useNavigate();
  const { request } = useApi();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    request<StudentRow[]>(`/classroom/assignments/${post.assignment!.id}/student-work`)
      .then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [post.assignment!.id]);

  const openStudent = (studentId: number) =>
    navigate(`/teacher/classroom/post/${postId}/student/${studentId}`);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left 1/3: student list */}
      <div className="lg:flex-[1] min-w-0">
        <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          {loading ? (
            <div className="p-4"><Skeleton /></div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-xs text-center" style={{ color: T.textMuted }}>No students.</div>
          ) : (
            rows.map((r, i) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.due;
              return (
                <button key={r.student.id} onClick={() => openStudent(r.student.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:opacity-80 transition-opacity"
                  style={{ borderTop: i ? `1px solid ${T.border}` : 'none' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: T.bgDeep, color: T.textSub }}>
                    {r.student.name?.[0] ?? '?'}
                  </div>
                  <span className="text-sm flex-1 truncate" style={{ color: T.text }}>{r.student.name}</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right 2/3: student cards with status */}
      <div className="lg:flex-[2] min-w-0">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: T.card }} />)}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textMuted }}>No students.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map(r => {
              const meta = STATUS_META[r.status] ?? STATUS_META.due;
              return (
                <button key={r.student.id} onClick={() => openStudent(r.student.id)}
                  className="text-left rounded-2xl p-4 transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: T.bgDeep, color: T.textSub }}>
                      {r.student.name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{r.student.name}</p>
                      {r.student.roll_number && <p className="text-xs truncate" style={{ color: T.textMuted }}>Roll {r.student.roll_number}</p>}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
                    style={{ background: T.bgDeep, color: meta.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} /> {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main detail page ──────────────────────────────────────────────────────────

export function PostDetail({ role }: { role: 'teacher' | 'student' }) {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { request } = useApi();

  const [post, setPost] = useState<ClassroomPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'instructions' | 'studentwork'>(
    (location.state as { tab?: 'instructions' | 'studentwork' } | null)?.tab ?? 'instructions'
  );

  useEffect(() => {
    setLoading(true);
    request<ClassroomPost>(`/classroom/posts/${postId}`)
      .then(setPost).catch(console.error).finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <Layout title="Post"><div className="max-w-5xl mx-auto"><Skeleton /></div></Layout>;
  if (!post) return <Layout title="Post not found"><div className="max-w-5xl mx-auto text-center py-12 text-sm" style={{ color: T.textMuted }}>This post could not be loaded.</div></Layout>;

  const isAssignment = post.post_type === 'assignment';
  const isMaterial = post.post_type === 'material';
  const isTeacher = role === 'teacher';
  const teacherName = post.author?.name ?? 'teacher';
  const onBack = () => navigate(-1);

  // Teacher assignment: two tabs
  if (isTeacher && isAssignment) {
    return (
      <Layout title={post.title || 'Assignment'}>
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-1 p-1 rounded-xl w-fit mb-5" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
            {([
              { id: 'instructions', label: 'Instructions' },
              { id: 'studentwork', label: 'Student work' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={tab === t.id ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: T.textMuted }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'instructions' ? (
            <div className="w-full"><LeftDetails post={post} onBack={onBack} /></div>
          ) : (
            <StudentWorkTab post={post} postId={postId!} />
          )}
        </div>
      </Layout>
    );
  }

  // Standard: left (+ right for student assignments)
  const showRight = role === 'student' && isAssignment && post.assignment;
  return (
    <Layout title={post.title || 'Post'}>
      <div className="max-w-5xl mx-auto">
        <div className={isMaterial || !showRight ? '' : 'flex flex-col lg:flex-row gap-6'}>
          <div className={isMaterial || !showRight ? 'w-full' : 'lg:flex-[3] min-w-0'}>
            <LeftDetails post={post} onBack={onBack} />
          </div>
          {showRight && (
            <div className="lg:flex-[1] min-w-0 space-y-4">
              <StudentWorkCard post={post} />
              <PrivateCommentsCard post={post} teacherName={teacherName} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
