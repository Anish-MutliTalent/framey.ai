import { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth, API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { Skeleton } from '../erp/UI';
import { RenderText } from '../erp/RenderText';
import {
  Send, Paperclip, Download, X, Plus, Users, Trash2,
  CheckCircle2, Calendar, Upload, Clock, ClipboardList, FileText, BookOpen,
  ChevronDown, ArrowLeft,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostFile { id: number; original_name: string; file_type?: string; size_bytes: number; mime_type?: string; }
export interface PostComment { id: number; author: { id: number; name: string; avatar_url?: string }; content: string; created_at: string; }
export interface ClassroomPost {
  id: number;
  section_id?: number | null;
  subject_id?: number | null;
  custom_classroom_id?: number | null;
  subject_name?: string | null;
  subject_color?: string | null;
  author: { id: number; name: string; avatar_url?: string };
  post_type: 'announcement' | 'assignment' | 'material';
  title?: string;
  content?: string;
  topic?: string;
  created_at: string;
  updated_at: string;
  files: PostFile[];
  comments: PostComment[];
  assignment?: { id: number; due_date?: string; max_marks: number; is_homework: boolean } | null;
}
export interface Person { id: number; name: string; email?: string; avatar_url?: string; roll_number?: string; }

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFileUrl() {
  const { token } = useAuth();
  return (fileId: number) =>
    `${API_BASE}/classroom/files/${fileId}/raw${token ? `?token=${token}` : ''}`;
}

export function useSubmissionFileUrl() {
  const { token } = useAuth();
  return (fileId: number) =>
    `${API_BASE}/classroom/submission-files/${fileId}/raw${token ? `?token=${token}` : ''}`;
}

export const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'], ['clean'],
  ],
};

// ── Submission panel (student) ────────────────────────────────────────────────

interface SubFile { id: number; original_name: string; mime_type?: string; size_bytes: number; }
interface MySubmission {
  id: number;
  content?: string | null;
  submitted_at?: string | null;
  marks_obtained?: number | null;
  feedback?: string | null;
  files: SubFile[];
}

function SubmissionPanel({ assignmentId, maxMarks }: { assignmentId: number; maxMarks: number }) {
  const { request } = useApi();
  const submissionFileUrl = useSubmissionFileUrl();
  const [sub, setSub] = useState<MySubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await request<MySubmission | null>(`/classroom/assignments/${assignmentId}/my-submission`);
      setSub(data ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [assignmentId]);

  const submit = async () => {
    if (submitting) return;
    if (!file && !content.trim()) { setError('Add a file or some text to submit.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('content', content);
      await request(`/classroom/assignments/${assignmentId}/submit`, { method: 'POST', body: fd });
      setFile(null); setContent('');
      await load();
    } catch (e) {
      setError((e instanceof Error ? e : new Error(String(e))).message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const graded = sub?.marks_obtained != null;

  return (
    <div className="mx-4 mb-3 rounded-2xl p-4 space-y-3"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Your work</span>
        {loading ? (
          <span className="text-xs" style={{ color: T.textMuted }}>Loading…</span>
        ) : sub ? (
          graded ? (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: T.success }}>
              <CheckCircle2 size={12} /> Graded: {sub.marks_obtained}/{maxMarks}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: T.info }}>
              <Clock size={12} /> Submitted
            </span>
          )
        ) : (
          <span className="text-xs font-medium" style={{ color: T.warning }}>Not submitted</span>
        )}
      </div>

      {sub?.feedback && (
        <div className="px-3 py-2 rounded-xl text-xs" style={{ background: T.successBg, color: T.success }}>
          <p className="font-semibold mb-0.5">Teacher feedback</p>
          <p className="leading-relaxed">{sub.feedback}</p>
        </div>
      )}

      {sub?.content && (
        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{sub.content}</p>
      )}
      {sub?.files?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sub.files.map(f => (
            <a key={f.id} href={submissionFileUrl(f.id)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
              <Download size={11} />{f.original_name}
            </a>
          ))}
        </div>
      )}
      {sub?.submitted_at && (
        <p className="text-xs" style={{ color: T.textMuted }}>
          Submitted {new Date(sub.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="pt-2 space-y-2" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
            <Upload size={12} /> {file ? file.name : (sub ? 'Replace file' : 'Add file')}
            <input type="file" className="hidden"
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <input type="text" value={content} onChange={e => setContent(e.target.value)}
            placeholder="Or type a short answer / note…"
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-xl text-xs outline-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
          <button onClick={submit} disabled={submitting}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
            style={{ background: T.accent, color: '#fff' }}>
            {submitting ? 'Submitting…' : sub ? 'Resubmit' : 'Submit'}
          </button>
        </div>
        {error && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Submissions + grading modal (teacher) ─────────────────────────────────────

interface SubmissionFile { id: number; original_name: string; mime_type?: string; size_bytes: number; }
interface SubmissionRow {
  id: number;
  student: { id: number; name: string } | null;
  content?: string | null;
  submitted_at?: string | null;
  marks_obtained?: number | null;
  feedback?: string | null;
  files: SubmissionFile[];
}

export function SubmissionsPanel({
  assignmentId, maxMarks,
}: {
  assignmentId: number; maxMarks: number;
}) {
  const { request } = useApi();
  const submissionFileUrl = useSubmissionFileUrl();
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<number, { marks: string; feedback: string; saved?: boolean }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await request<SubmissionRow[]>(`/classroom/assignments/${assignmentId}/submissions`);
      setSubs(data);
      const g: Record<number, { marks: string; feedback: string }> = {};
      for (const s of data) {
        g[s.id] = {
          marks: s.marks_obtained != null ? String(s.marks_obtained) : '',
          feedback: s.feedback ?? '',
        };
      }
      setGrades(g);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [assignmentId]);

  const saveGrade = async (subId: number) => {
    const draft = grades[subId];
    if (!draft) return;
    setSaving(subId);
    try {
      await request(`/classroom/submissions/${subId}/grade`, {
        method: 'PATCH',
        body: {
          marks_obtained: draft.marks === '' ? 0 : Number(draft.marks),
          feedback: draft.feedback || null,
        },
      });
      setGrades(prev => ({ ...prev, [subId]: { ...prev[subId], saved: true } }));
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed to save grade');
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-3">
      {loading && <Skeleton />}
      {!loading && subs.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: T.textMuted }}>
          No submissions yet.
        </div>
      )}
      {!loading && subs.map(s => {
        const draft = grades[s.id] ?? { marks: '', feedback: '' };
        const graded = s.marks_obtained != null;
        return (
          <div key={s.id} className="rounded-2xl p-3 space-y-2"
            style={{ background: T.bg, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: T.bgDeep, color: T.textSub }}>
                  {s.student?.name?.[0] ?? '?'}
                </div>
                <span className="text-xs font-semibold truncate" style={{ color: T.text }}>{s.student?.name ?? 'Unknown'}</span>
              </div>
              {graded && (
                <span className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: T.success }}>
                  <CheckCircle2 size={11} /> {s.marks_obtained}/{maxMarks}
                </span>
              )}
            </div>

            {s.content && (
              <p className="text-xs leading-relaxed whitespace-pre-wrap pl-8" style={{ color: T.textSub }}>
                {s.content}
              </p>
            )}

            {s.files?.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-8">
                {s.files.map(f => (
                  <a key={f.id} href={submissionFileUrl(f.id)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
                    <Download size={10} />{f.original_name}
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1.5 pl-8">
              <input type="number" min={0} max={maxMarks} value={draft.marks}
                onChange={e => setGrades(prev => ({ ...prev, [s.id]: { ...prev[s.id], marks: e.target.value, saved: false } }))}
                title={`Marks / ${maxMarks}`}
                className="w-14 px-2 py-1 rounded-lg text-xs outline-none"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              <input type="text" value={draft.feedback}
                onChange={e => setGrades(prev => ({ ...prev, [s.id]: { ...prev[s.id], feedback: e.target.value, saved: false } }))}
                placeholder="Feedback…"
                className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs outline-none"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              <button onClick={() => saveGrade(s.id)} disabled={saving === s.id}
                className="px-2 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 shrink-0"
                style={{ background: T.accent, color: '#fff' }}>
                {saving === s.id ? '…' : draft.saved ? '✓' : 'Save'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SubmissionsModal({
  assignmentId, maxMarks, title, onClose,
}: {
  assignmentId: number; maxMarks: number; title: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{
        background: T.card, border: `1px solid ${T.border}`, maxHeight: '90vh',
      }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: T.text }}>Submissions</h3>
            <p className="text-xs" style={{ color: T.textMuted }}>{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <SubmissionsPanel assignmentId={assignmentId} maxMarks={maxMarks} />
        </div>
      </div>
    </div>
  );
}

// ── Post card (role-aware) ────────────────────────────────────────────────────

export function PostCard({
  post, refresh, currentUserId, role,
}: {
  post: ClassroomPost;
  refresh: () => Promise<void>;
  currentUserId: number;
  role: 'teacher' | 'student';
}) {
  const { request } = useApi();
  const fileUrl = useFileUrl();
  const [replyText, setReplyText] = useState('');
  const [showFull, setShowFull] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showSubs, setShowSubs] = useState(false);

  const submitReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      await request(`/classroom/posts/${post.id}/comments`, { method: 'POST', body: { content: replyText.trim() } });
      setReplyText('');
      await refresh();
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed to post comment');
    } finally { setPosting(false); }
  };

  const deletePost = async () => {
    if (!confirm('Delete this post?')) return;
    await request(`/classroom/posts/${post.id}`, { method: 'DELETE' });
    await refresh();
  };

  const iconBg = post.post_type === 'assignment' ? T.warningBg
    : post.post_type === 'material' ? T.successBg
    : T.infoBg;
  const iconColor = post.post_type === 'assignment' ? T.warning
    : post.post_type === 'material' ? T.success
    : T.info;
  const typeLabel = post.post_type === 'assignment' ? 'Assignment'
    : post.post_type === 'material' ? 'Material'
    : 'Announcement';
  const isOwnPost = post.author?.id === currentUserId;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-start gap-3 p-4">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: iconBg, color: iconColor }}>
          {post.author?.name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: T.text }}>{post.author?.name ?? 'Unknown'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: iconBg, color: iconColor }}>{typeLabel}</span>
            <span className="text-xs" style={{ color: T.textMuted }}>
              {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {post.title && (
            <h3 className="text-sm font-bold mt-1 leading-snug" style={{ color: T.text }}>{post.title}</h3>
          )}
        </div>
        {isOwnPost && (
          <button onClick={deletePost}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
            style={{ color: T.danger }} title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Teacher: open submissions for an assignment */}
      {role === 'teacher' && post.post_type === 'assignment' && post.assignment && (
        <div className="px-4 pb-3 -mt-1">
          <button onClick={() => setShowSubs(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
            style={{ background: T.bgDeep, color: T.textSub, border: `1px solid ${T.border}` }}>
            <ClipboardList size={13} /> Submissions
          </button>
        </div>
      )}

      {post.content && (
        <div className="px-4 pb-3">
          {post.content.length > 280 && !showFull ? (
            <>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub }}>
                {post.content.slice(0, 280)}…
              </p>
              <button onClick={() => setShowFull(true)} className="text-xs mt-1 hover:underline"
                style={{ color: T.accent }}>Show more</button>
            </>
          ) : (
            <RenderText text={post.content} tag="p"
              className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }} />
          )}
        </div>
      )}

      {post.assignment && (post.assignment.due_date || (post.assignment.max_marks || 0) > 0) && (
        <div className="mx-4 mb-3 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-medium"
          style={{ background: T.warningBg, color: T.warning }}>
          {post.assignment.due_date && (
            <>
              <Calendar size={13} />
              Due {new Date(post.assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </>
          )}
          {(post.assignment.max_marks || 0) > 0 && (
            <span style={{ color: T.textMuted }}>
              {post.assignment.due_date ? ' · ' : ''}{post.assignment.max_marks} pts
            </span>
          )}
        </div>
      )}

      {/* Student: submit / view submission for an assignment */}
      {role === 'student' && post.post_type === 'assignment' && post.assignment && (
        <SubmissionPanel assignmentId={post.assignment.id} maxMarks={post.assignment.max_marks} />
      )}

      {post.files?.length > 0 && (
        <div className="mx-4 pb-3 flex flex-wrap gap-2">
          {post.files.map(f => (
            <a key={f.id}
              href={fileUrl(f.id)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
              <Paperclip size={11} />{f.original_name}
            </a>
          ))}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${T.border}` }}>
        {post.comments?.length > 0 && (
          <div className="px-4 py-3 space-y-2.5" style={{ background: T.bg }}>
            {post.comments.map(c => (
              <div key={c.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: T.bgDeep, color: T.textSub }}>
                  {c.author.name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold" style={{ color: T.text }}>{c.author.name}</span>
                    <span className="text-xs" style={{ color: T.textMuted }}>
                      {new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3" style={{ background: T.card }}>
          <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitReply()}
            placeholder="Add a class comment…"
            disabled={posting}
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
          <button onClick={submitReply} disabled={posting || !replyText.trim()}
            className="p-2 rounded-xl disabled:opacity-40 hover:opacity-80 transition-opacity"
            style={{ background: T.accent, color: '#fff' }}>
            <Send size={14} />
          </button>
        </div>
      </div>

      {showSubs && post.assignment && (
        <SubmissionsModal
          assignmentId={post.assignment.id}
          maxMarks={post.assignment.max_marks}
          title={post.title || 'Assignment'}
          onClose={() => setShowSubs(false)}
        />
      )}
    </div>
  );
}

// ── Compact post card (assignment / material in the stream) ────────────────────

export function CompactPostCard({
  post, role,
}: {
  post: ClassroomPost;
  role: 'teacher' | 'student';
}) {
  const navigate = useNavigate();
  const isAssignment = post.post_type === 'assignment';
  const Icon = isAssignment ? ClipboardList : BookOpen;
  const iconBg = isAssignment ? T.warningBg : T.successBg;
  const iconColor = isAssignment ? T.warning : T.success;
  const detailPath = `/${role}/classroom/post/${post.id}`;

  return (
    <button onClick={() => navigate(detailPath)}
      className="w-full rounded-2xl p-4 text-left transition-all hover:opacity-90 hover:-translate-y-0.5"
      style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: iconBg, color: iconColor }}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold capitalize truncate" style={{ color: T.text }}>
              New {post.post_type}: {post.title || 'Untitled'}
            </span>
          </div>
          <span className="text-xs" style={{ color: T.textMuted }}>
            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {isAssignment && post.assignment?.due_date && (
          <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: T.warning }}>
            <Calendar size={11} /> Due {new Date(post.assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </button>
  );
}

// ── New post modal (parametrized by create path) ──────────────────────────────

export function NewPostModal({
  createPath, refresh, onClose, allowedTypes = ['announcement', 'assignment', 'material'],
}: {
  createPath: string;
  refresh: () => Promise<void>;
  onClose: () => void;
  allowedTypes?: ('announcement' | 'assignment' | 'material')[];
}) {
  const { request } = useApi();
  const isAnnouncementOnly =
    allowedTypes.length === 1 && allowedTypes[0] === 'announcement';

  const [postType, setPostType] = useState<'announcement' | 'assignment' | 'material'>(allowedTypes[0] ?? 'announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = isAnnouncementOnly
    ? (content.trim().length > 0 || files.length > 0)
    : title.trim().length > 0;

  const submit = async () => {
    if (isAnnouncementOnly) {
      if (!content.trim() && files.length === 0) { setError('Add some text or an attachment.'); return; }
    } else if (!title.trim()) { setError('Title is required'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('post_type', isAnnouncementOnly ? 'announcement' : postType);
      fd.append('title', isAnnouncementOnly ? '' : title);
      fd.append('content', content);
      fd.append('topic', isAnnouncementOnly ? '' : topic);
      fd.append('due_date', isAnnouncementOnly ? '' : dueDate);
      for (const f of files) fd.append('files', f);
      await request(createPath, { method: 'POST', body: fd });
      await refresh();
      onClose();
    } catch (e) {
      setError((e instanceof Error ? e : new Error(String(e))).message || 'Failed to post');
    } finally { setSubmitting(false); }
  };

  const fileInputId = 'attach-input';

  const attachmentBlock = (
    <div>
      <label htmlFor={fileInputId}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs cursor-pointer hover:opacity-80 transition-opacity w-fit"
        style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
        <Paperclip size={14} /> Attach files
      </label>
      <input id={fileInputId} type="file" multiple className="hidden"
        accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt,.md,.csv"
        onChange={e => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; }} />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 rounded-xl overflow-hidden"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <span className="text-xs px-2.5 py-1.5 max-w-[180px] truncate" style={{ color: T.textSub }}>{f.name}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                className="px-2 py-1.5 hover:bg-red-50 transition-colors border-l"
                style={{ color: T.danger, borderColor: T.border }}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{
        background: T.card, border: `1px solid ${T.border}`, maxHeight: '90vh',
      }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: T.text }}>
              {isAnnouncementOnly ? 'New announcement' : 'New classwork'}
            </h3>
            <p className="text-xs" style={{ color: T.textMuted }}>
              {isAnnouncementOnly ? 'Share with your class.' : 'Create an assignment or material.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <X size={16} />
          </button>
        </div>

        {isAnnouncementOnly ? (
          /* ── Simplified announcement: one text box + attachments ── */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Share something with your class…"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text, minHeight: 120 }} />
            {attachmentBlock}
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>
            )}
          </div>
        ) : (
          /* ── Full classwork layout: type tabs + title + content + topic/due + attachments ── */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex gap-2 p-1 rounded-xl w-fit" style={{ background: T.bgDeep }}>
              {allowedTypes.map(t => (
                <button key={t} onClick={() => setPostType(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={postType === t ? { background: T.card, color: T.text, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: T.textMuted }}>
                  {t}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Worksheet 1 — Linear Equations"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Content</label>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                <ReactQuill theme="snow" value={content} onChange={setContent} modules={quillModules}
                  placeholder="Add details, instructions, or links…"
                  style={{ background: T.card, color: T.text, minHeight: 120 }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Topic (optional)</label>
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Algebra"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
              {postType === 'assignment' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Due date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
                </div>
              )}
            </div>
            {attachmentBlock}
            {error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 p-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs" style={{ color: T.textMuted }}>Cancel</button>
          <button onClick={submit} disabled={submitting || !canSubmit}
            className="px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
            style={{ background: T.accent, color: '#fff' }}>
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Classwork create button ("+ Create" dropdown) ────────────────────────────

export function CreateClassworkButton({ onPick }: { onPick: (t: 'assignment' | 'material') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
        style={{ background: T.accent, color: '#fff' }}>
        <Plus size={13} /> Create <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} tabIndex={-1} />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl overflow-hidden shadow-xl"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            {(['assignment', 'material'] as const).map(t => (
              <button key={t} onClick={() => { onPick(t); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-medium capitalize hover:opacity-80 transition-opacity"
                style={{ color: T.text, borderTop: t === 'material' ? `1px solid ${T.border}` : 'none' }}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Classwork modal (assignment / material) with Assign / Schedule / Save draft ─

export interface EditableClasswork {
  id: number;
  title?: string | null;
  content?: string | null;
  topic?: string | null;
  due_date?: string | null;
  max_marks?: number | null;
  is_draft?: boolean;
  scheduled_at?: string | null;
  files: PostFile[];
}

export function ClassworkModal({
  createPath, postType, refresh, onClose, editPost,
}: {
  createPath: string;
  postType: 'assignment' | 'material';
  refresh: () => Promise<void>;
  onClose: () => void;
  editPost?: EditableClasswork | null;
}) {
  const { request } = useApi();
  const fileUrl = useFileUrl();
  const isAssignment = postType === 'assignment';
  const isEdit = !!editPost;

  const isoToDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
  const isoToDateTime = (iso?: string | null) => (iso ? iso.slice(0, 16) : '');

  const [title, setTitle] = useState(editPost?.title ?? '');
  const [instructions, setInstructions] = useState(editPost?.content ?? '');
  const [points, setPoints] = useState(editPost?.max_marks ? String(editPost.max_marks) : '');
  const [dueDate, setDueDate] = useState(isoToDate(editPost?.due_date));
  const [topic, setTopic] = useState(editPost?.topic ?? '');
  const [scheduledAt, setScheduledAt] = useState(isoToDateTime(editPost?.scheduled_at));
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'assign' | 'schedule' | 'draft'>(
    editPost?.is_draft ? 'draft' : (editPost?.scheduled_at ? 'schedule' : 'assign')
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = title.trim().length > 0 && (mode !== 'schedule' || !!scheduledAt);

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (mode === 'schedule' && !scheduledAt) { setError('Pick a date and time to schedule.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('post_type', postType);
      fd.append('title', title);
      fd.append('content', instructions);
      fd.append('topic', topic);
      fd.append('due_date', isAssignment ? dueDate : '');
      fd.append('max_marks', isAssignment ? String(Number(points) || 0) : '0');
      fd.append('is_draft', mode === 'draft' ? 'true' : 'false');
      fd.append('scheduled_at', mode === 'schedule' ? scheduledAt : '');
      for (const f of files) fd.append('files', f);
      const path = isEdit ? `/classroom/posts/${editPost!.id}` : createPath;
      await request(path, { method: isEdit ? 'PATCH' : 'POST', body: fd });
      await refresh();
      onClose();
    } catch (e) {
      setError((e instanceof Error ? e : new Error(String(e))).message || 'Failed to save');
    } finally { setSubmitting(false); }
  };

  const modeLabel = mode === 'assign' ? (isAssignment ? 'Assign' : 'Post')
    : mode === 'schedule' ? 'Schedule' : 'Save draft';

  const menuItems: { id: typeof mode; label: string }[] = [
    { id: 'assign', label: isAssignment ? 'Assign now' : 'Post' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'draft', label: 'Save draft' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{
        background: T.card, border: `1px solid ${T.border}`, maxHeight: '90vh',
      }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h3 className="text-base font-semibold capitalize" style={{ color: T.text }}>
              {isEdit ? 'Edit' : 'New'} {postType}
            </h3>
            <p className="text-xs" style={{ color: T.textMuted }}>
              {isAssignment
                ? (isEdit ? 'Edit this assignment.' : 'Create an assignment for your class.')
                : (isEdit ? 'Edit this material.' : 'Add material for your class.')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={isAssignment ? 'e.g. Worksheet 1 — Linear Equations' : 'e.g. Reading: Chapter 5'}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
          </div>

          {/* Instructions / Description (plain) */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>
              {isAssignment ? 'Instructions (optional)' : 'Description (optional)'}
            </label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
              placeholder={isAssignment ? 'Add instructions for your students…' : 'Add a description…'}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text, minHeight: 100 }} />
          </div>

          {/* Points / Due / Topic — all optional */}
          <div className="grid grid-cols-3 gap-3">
            {isAssignment && (
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Points</label>
                <input type="number" min={0} value={points} onChange={e => setPoints(e.target.value)}
                  placeholder="No points"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
            )}
            {isAssignment && (
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Due</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
            )}
            <div className={isAssignment ? '' : 'col-span-3'}>
              <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="No topic"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
          </div>

          {/* Schedule picker */}
          {mode === 'schedule' && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Schedule for</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
          )}

          {/* Existing attachments (edit mode — read-only links) */}
          {isEdit && editPost && editPost.files.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: T.textSub }}>Current attachments</p>
              <div className="flex flex-wrap gap-2">
                {editPost.files.map(f => (
                  <a key={f.id} href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                    <Paperclip size={11} />{f.original_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* New attachment chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1 rounded-xl overflow-hidden"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
                  <span className="text-xs px-2.5 py-1.5 max-w-[200px] truncate" style={{ color: T.textSub }}>{f.name}</span>
                  <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    className="px-2 py-1.5 hover:bg-red-50 transition-colors border-l"
                    style={{ color: T.danger, borderColor: T.border }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: T.dangerBg, color: T.danger }}>{error}</p>
          )}
        </div>

        {/* Footer: attach (left) + cancel + Assign split (right) */}
        <div className="flex items-center justify-between gap-2 p-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
            <Paperclip size={14} /> Attach
            <input type="file" multiple className="hidden"
              accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt,.md,.csv"
              onChange={e => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ''; }} />
          </label>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs" style={{ color: T.textMuted }}>Cancel</button>
            <div className="relative flex">
              <button onClick={submit} disabled={submitting || !canSubmit}
                className="px-4 py-2 rounded-l-xl text-xs font-semibold disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                {submitting ? (isAssignment ? 'Saving…' : 'Posting…') : modeLabel}
              </button>
              <button onClick={() => setMenuOpen(o => !o)} disabled={submitting}
                className="px-2 py-2 rounded-r-xl disabled:opacity-40"
                style={{ background: T.accent, color: '#fff', borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} tabIndex={-1} />
                  <div className="absolute right-0 bottom-full mb-1 z-20 w-40 rounded-xl overflow-hidden shadow-xl"
                    style={{ background: T.card, border: `1px solid ${T.border}` }}>
                    {menuItems.map(m => (
                      <button key={m.id} onClick={() => { setMode(m.id); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ color: mode === m.id ? T.accent : T.text, borderTop: m.id !== 'assign' ? `1px solid ${T.border}` : 'none' }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── People-tab helpers ────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>{title}</p>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.card }}>
        {children}
      </div>
    </div>
  );
}

export function PersonRow({ person, subtitle }: { person: Person; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: T.bgDeep, color: T.textSub }}>
        {person.avatar_url
          ? <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-full" />
          : <span>{person.name?.[0]?.toUpperCase() ?? '?'}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: T.text }}>{person.name}</div>
        {subtitle && <div className="text-xs truncate" style={{ color: T.textMuted }}>{subtitle}</div>}
        {!subtitle && person.email && <div className="text-xs truncate" style={{ color: T.textMuted }}>{person.email}</div>}
      </div>
    </div>
  );
}

// Re-export commonly used icons for classroom pages
export { Plus, Users, FileText, BookOpen } from 'lucide-react';
