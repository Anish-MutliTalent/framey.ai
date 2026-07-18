import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../erp/Layout';
import { Skeleton } from '../erp/UI';
import { useApi } from '../../hooks/useApi';
import { useAuth, API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import {
  useSubmissionFileUrl,
  type ClassroomPost,
} from './parts';
import {
  ArrowLeft, FileText, Paperclip, Send, CheckCircle2, Clock, AlertCircle, Download,
} from 'lucide-react';

interface ProjectFile { id: number; original_name: string; file_type?: string; mime_type?: string; is_submitted?: boolean; }
interface SubmissionData {
  id: number;
  content?: string | null;
  marks_obtained?: number | null;
  feedback?: string | null;
  project?: { id: number; title: string; files: ProjectFile[] } | null;
  files: { id: number; original_name: string; mime_type?: string; size_bytes: number }[];
}
interface StudentData {
  student: { id: number; name: string; roll_number?: string; avatar_url?: string };
  status: string;
  submission: SubmissionData | null;
}
interface PrivateComment {
  id: number; author: { id: number; name: string }; content: string; created_at: string;
}

interface Attachment {
  kind: 'submission' | 'project';
  id: number;
  original_name: string;
  mime_type?: string;
  file_type?: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  turned_in: { label: 'Turned In', color: T.success, icon: CheckCircle2 },
  marked_done: { label: 'Marked Done', color: T.info, icon: CheckCircle2 },
  missing: { label: 'Missing', color: T.danger, icon: AlertCircle },
  due: { label: 'Due', color: T.warning, icon: Clock },
};

export function StudentSubmissionViewer() {
  const { postId, studentId } = useParams<{ postId: string; studentId: string }>();
  const navigate = useNavigate();
  const { request } = useApi();
  const { token } = useAuth();
  const submissionFileUrl = useSubmissionFileUrl();
  const projectFileUrl = (id: number) => `${API_BASE}/project-files/${id}/raw${token ? `?token=${token}` : ''}`;

  const [post, setPost] = useState<ClassroomPost | null>(null);
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Attachment | null>(null);

  // grading
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // private comments
  const [comments, setComments] = useState<PrivateComment[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await request<ClassroomPost>(`/classroom/posts/${postId}`);
      setPost(p);
      if (p.assignment) {
        const sd = await request<StudentData>(`/classroom/assignments/${p.assignment.id}/student/${studentId}`);
        setData(sd);
        if (sd.submission) {
          setMarks(sd.submission.marks_obtained != null ? String(sd.submission.marks_obtained) : '');
          setFeedback(sd.submission.feedback ?? '');
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [postId, studentId]);

  // attachments from submission files + project files
  const attachments: Attachment[] = [];
  if (data?.submission) {
    for (const f of data.submission.files) {
      attachments.push({ kind: 'submission', id: f.id, original_name: f.original_name, mime_type: f.mime_type });
    }
    if (data.submission.project) {
      for (const f of data.submission.project.files) {
        attachments.push({ kind: 'project', id: f.id, original_name: f.original_name, mime_type: f.mime_type, file_type: f.file_type });
      }
    }
  }

  useEffect(() => {
    if (!selected && attachments.length > 0) setSelected(attachments[0]);
  }, [attachments.length]);

  const attachmentUrl = (a: Attachment) =>
    a.kind === 'submission' ? submissionFileUrl(a.id) : projectFileUrl(a.id);

  const saveGrade = async () => {
    if (!data?.submission || saving) return;
    setSaving(true);
    try {
      await request(`/classroom/submissions/${data.submission.id}/grade`, {
        method: 'PATCH',
        body: { marks_obtained: marks === '' ? 0 : Number(marks), feedback: feedback || null },
      });
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const loadComments = async () => {
    try {
      const c = await request<PrivateComment[]>(`/classroom/posts/${postId}/private-comments?student_id=${studentId}`);
      setComments(c);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { loadComments(); }, [postId, studentId]);

  const sendComment = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await request(`/classroom/posts/${postId}/private-comments`, {
        method: 'POST', body: { content: text.trim(), student_id: Number(studentId) },
      });
      setText('');
      await loadComments();
    } catch (e) {
      alert((e instanceof Error ? e : new Error(String(e))).message || 'Failed');
    } finally { setPosting(false); }
  };

  if (loading) return <Layout title="Student work"><div className="max-w-5xl mx-auto"><Skeleton /></div></Layout>;
  if (!post || !data) return <Layout title="Not found"><div className="max-w-5xl mx-auto text-center py-12 text-sm" style={{ color: T.textMuted }}>Could not load.</div></Layout>;

  const maxMarks = post.assignment?.max_marks ?? 100;
  const meta = STATUS_META[data.status] ?? STATUS_META.due;
  const StatusIcon = meta.icon;
  const teacherName = post.author?.name ?? 'teacher';

  const selectedIsImage = selected && ((selected.file_type === 'image') || ((selected.mime_type || '').startsWith('image/')));
  const selectedIsPdf = selected && (selected.file_type === 'pdf' || (selected.mime_type || '').includes('pdf'));

  return (
    <Layout title={`${data.student.name} · ${post.title || 'Assignment'}`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left 3/4: document viewer */}
          <div className="lg:flex-[3] min-w-0">
            <div className="rounded-2xl p-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <button onClick={() => navigate(`/teacher/classroom/post/${postId}`, { state: { tab: 'studentwork' } })}
                  className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors shrink-0" style={{ color: T.textMuted }}>
                  <ArrowLeft size={18} />
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: T.bgDeep, color: T.textSub }}>
                  {data.student.name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{data.student.name}</p>
                  <p className="text-xs truncate" style={{ color: T.textMuted }}>{post.title || 'Assignment'}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: meta.color }}>
                  <StatusIcon size={13} /> {meta.label}
                </span>
              </div>

              {/* Viewer */}
              <div className="mt-3" style={{ minHeight: 400 }}>
                {!selected ? (
                  <div className="flex flex-col items-center justify-center py-20" style={{ color: T.textMuted }}>
                    <FileText size={40} strokeWidth={1.2} />
                    <p className="text-sm mt-3">No attachments to view.</p>
                    {data.submission?.content && (
                      <p className="text-xs mt-3 max-w-md whitespace-pre-wrap text-center" style={{ color: T.textSub }}>{data.submission.content}</p>
                    )}
                  </div>
                ) : selectedIsImage ? (
                  <img src={attachmentUrl(selected)} alt={selected.original_name}
                    className="w-full rounded-xl" style={{ border: `1px solid ${T.border}` }} />
                ) : selectedIsPdf ? (
                  <iframe src={attachmentUrl(selected)} title={selected.original_name}
                    className="w-full rounded-xl" style={{ border: `1px solid ${T.border}`, height: '70vh' }} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20" style={{ color: T.textMuted }}>
                    <FileText size={40} strokeWidth={1.2} />
                    <p className="text-sm mt-3">{selected.original_name}</p>
                    <a href={attachmentUrl(selected)} target="_blank" rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                      <Download size={12} /> Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right 1/4: attachments + grading + private comments */}
          <div className="lg:flex-[1] min-w-0 space-y-4">
            {/* Attachments list */}
            <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>Attachments</p>
              {attachments.length === 0 ? (
                <p className="text-xs" style={{ color: T.textMuted }}>No files submitted.</p>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map(a => (
                    <button key={`${a.kind}-${a.id}`} onClick={() => setSelected(a)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:opacity-80"
                      style={{
                        background: selected?.id === a.id && selected?.kind === a.kind ? T.bgDeep : 'transparent',
                        border: `1px solid ${T.border}`,
                      }}>
                      <FileText size={13} style={{ color: T.textSub }} />
                      <span className="text-xs truncate flex-1" style={{ color: T.text }}>{a.original_name}</span>
                      {a.kind === 'project' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: T.infoBg, color: T.info }}>project</span>}
                    </button>
                  ))}
                </div>
              )}
              {data.submission?.content && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.textMuted }}>Text</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{data.submission.content}</p>
                </div>
              )}
            </div>

            {/* Grading */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Grading</p>
              {data.submission ? (
                <>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: T.textMuted }}>Marks / {maxMarks}</label>
                    <input type="number" min={0} max={maxMarks} value={marks}
                      onChange={e => setMarks(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
                      style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: T.textMuted }}>Feedback</label>
                    <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                      placeholder="Optional teacher comment…"
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none resize-y"
                      style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text, minHeight: 60 }} />
                  </div>
                  <button onClick={saveGrade} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ background: T.accent, color: '#fff' }}>
                    {saving ? 'Saving…' : 'Save grade'}
                  </button>
                </>
              ) : (
                <p className="text-xs" style={{ color: T.textMuted }}>No submission to grade yet.</p>
              )}
            </div>

            {/* Private comments */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm font-semibold" style={{ color: T.text }}>Private comments</p>
              <div className="space-y-2.5">
                {comments.length === 0 && <p className="text-xs" style={{ color: T.textMuted }}>No private comments yet.</p>}
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: T.bgDeep, color: T.textSub }}>{c.author.name?.[0] ?? '?'}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold" style={{ color: T.text }}>{c.author.name}</span>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: T.textSub }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <input type="text" value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendComment()}
                  placeholder={`Reply to ${data.student.name}…`}
                  className="flex-1 px-2.5 py-2 rounded-xl text-xs outline-none"
                  style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
                <button onClick={sendComment} disabled={posting || !text.trim()}
                  className="p-2 rounded-xl disabled:opacity-40 hover:opacity-80" style={{ background: T.accent, color: '#fff' }}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
