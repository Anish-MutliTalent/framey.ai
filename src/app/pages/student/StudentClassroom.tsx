import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/erp/Layout';
import { Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import {
  PostCard, NewPostModal, CompactPostCard, Section, PersonRow,
  type ClassroomPost, type PostFile, type Person,
} from '../../components/classroom/parts';
import {
  ArrowLeft, Plus, Users, FileText, BookOpen, Calendar, ClipboardList,
} from 'lucide-react';

interface ClassroomPublic {
  section_id: number; section_name: string; section_label: string;
  subject_id: number; subject_name: string; subject_color: string;
  class_teacher_name?: string; teacher_name: string;
}
type Tab = 'stream' | 'classwork' | 'people';

// ── Main ───────────────────────────────────────────────────────────────────────

export function StudentClassroom() {
  const { sectionId, subjectId } = useParams<{ sectionId: string; subjectId: string }>();
  const navigate = useNavigate();
  const { request } = useApi();

  const [tab, setTab] = useState<Tab>('stream');
  const [classroom, setClassroom] = useState<ClassroomPublic | null>(null);
  const [posts, setPosts] = useState<ClassroomPost[]>([]);
  const [people, setPeople] = useState<{
    class_teacher?: { id: number; name: string; email: string; avatar_url?: string };
    teachers: { id: number; name: string; email: string; avatar_url?: string }[];
    students: { id: number; name: string; roll_number?: string; avatar_url?: string }[];
  } | null>(null);
  const [classwork, setClasswork] = useState<{ topic: string; items: {
    id: number; type: 'assignment' | 'material'; title?: string; content?: string;
    topic?: string; created_at: string; due_date?: string; max_marks?: number;
    is_draft?: boolean; scheduled_at?: string | null;
    files: PostFile[];
  }[] }[]>([]);

  const [loadingStream, setLoadingStream] = useState(true);
  const [loadingClasswork, setLoadingClasswork] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(0);
  const [showNewPost, setShowNewPost] = useState(false);

  useEffect(() => {
    request<ClassroomPublic[]>('/classroom/classes').then(list => {
      const found = list.find(c => c.section_id === Number(sectionId) && c.subject_id === Number(subjectId));
      setClassroom(found ?? null);
    });
    request<{ id: number }>('/auth/me').then(u => setCurrentUserId(u.id)).catch(() => {});
  }, [sectionId, subjectId, request]);

  const loadStream = async () => {
    if (!sectionId || !subjectId) return;
    setLoadingStream(true);
    await request<ClassroomPost[]>(`/classroom/sections/${sectionId}/subjects/${subjectId}/posts`)
      .then(setPosts).catch(console.error)
      .finally(() => setLoadingStream(false));
  };

  useEffect(() => { loadStream(); }, [sectionId, subjectId, request]);

  const loadClasswork = async () => {
    if (!sectionId || !subjectId) return;
    setLoadingClasswork(true);
    await request(`/classroom/sections/${sectionId}/subjects/${subjectId}/classwork`)
      .then(setClasswork).catch(console.error)
      .finally(() => setLoadingClasswork(false));
  };

  const loadPeople = async () => {
    if (!sectionId || !subjectId) return;
    setLoadingPeople(true);
    await request(`/classroom/sections/${sectionId}/subjects/${subjectId}/people`)
      .then(setPeople).catch(console.error)
      .finally(() => setLoadingPeople(false));
  };

  useEffect(() => {
    if (tab === 'classwork') loadClasswork();
    if (tab === 'people') loadPeople();
  }, [tab, sectionId, subjectId]);

  const headerColor = classroom?.subject_color ?? T.accent;
  const classTitle = classroom
    ? `${classroom.section_label} ${classroom.subject_name}`
    : 'Classroom';

  return (
    <Layout title={classTitle}>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Coloured banner with class title */}
        <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: headerColor }}>
          <button onClick={() => navigate('/student/classroom')}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors shrink-0" style={{ color: '#fff' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate" style={{ color: '#fff' }}>{classTitle}</h1>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {classroom?.teacher_name ?? ''}{classroom?.class_teacher_name && ` · Class teacher ${classroom.class_teacher_name}`}
            </p>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          {([
            { id: 'stream',    label: 'Stream',    icon: FileText },
            { id: 'classwork', label: 'Classwork', icon: BookOpen },
            { id: 'people',    label: 'People',    icon: Users },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === t.id
                ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: T.textMuted }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* ── STREAM ─────────────────────────────────────────────────────────── */}
        {tab === 'stream' && (
          <div className="space-y-4">
            {/* Student: share something with the class (announcements only) */}
            <div className="rounded-2xl p-4 space-y-2" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-xs" style={{ color: T.textMuted }}>
                Share something with the class — a question, a note, or a heads-up.
              </p>
              <button onClick={() => setShowNewPost(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                style={{ background: T.bgDeep, color: T.textSub, border: `1px solid ${T.border}` }}>
                <Plus size={12} /> Post to stream
              </button>
            </div>

            {loadingStream && <Skeleton />}
            {!loadingStream && posts.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: T.textMuted }}>
                No posts in this classroom yet.
              </div>
            )}
            {posts.map(p => (
              p.post_type === 'announcement'
                ? <PostCard key={p.id} post={p} refresh={loadStream} currentUserId={currentUserId} role="student" />
                : <CompactPostCard key={p.id} post={p} role="student" />
            ))}
          </div>
        )}

        {/* ── CLASSWORK ─────────────────────────────────────────────────────── */}
        {tab === 'classwork' && (
          <div className="space-y-5">
            {loadingClasswork && <Skeleton />}
            {!loadingClasswork && classwork.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: T.textMuted }}>
                No classwork posted yet.
              </div>
            )}
            {classwork.map(group => (
              <div key={group.topic}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>
                  {group.topic}
                </p>
                <div className="space-y-2">
                  {group.items.map(item => {
                    const isAssignment = item.type === 'assignment';
                    const ItemIcon = isAssignment ? ClipboardList : BookOpen;
                    return (
                      <button key={item.id} onClick={() => navigate(`/student/classroom/post/${item.id}`)}
                        className="w-full rounded-2xl p-4 text-left transition-all hover:opacity-90"
                        style={{ background: T.card, border: `1px solid ${T.border}` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: isAssignment ? T.warningBg : T.successBg, color: isAssignment ? T.warning : T.success }}>
                            <ItemIcon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold capitalize" style={{ color: T.text }}>
                              New {item.type}: {item.title || 'Untitled'}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {item.due_date && (
                                <span className="text-xs flex items-center gap-1" style={{ color: T.warning }}>
                                  <Calendar size={10} /> Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {!!item.max_marks && (
                                <span className="text-xs" style={{ color: T.textMuted }}>{item.max_marks} pts</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PEOPLE ────────────────────────────────────────────────────────── */}
        {tab === 'people' && (
          <div className="space-y-4">
            {loadingPeople && <Skeleton />}
            {!loadingPeople && people && (
              <>
                {people.class_teacher && (
                  <Section title="Class Teacher">
                    <PersonRow person={people.class_teacher} />
                  </Section>
                )}
                {people.teachers.length > 0 && (
                  <Section title={`Subject Teacher${people.teachers.length > 1 ? 's' : ''}`}>
                    {people.teachers.map(p => <PersonRow key={p.id} person={p} subtitle={classroom?.subject_name} />)}
                  </Section>
                )}
                {people.students.length > 0 && (
                  <Section title={`Students (${people.students.length})`}>
                    {people.students.map(p => <PersonRow key={p.id} person={p} subtitle={p.roll_number ? `Roll ${p.roll_number}` : undefined} />)}
                  </Section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showNewPost && (
        <NewPostModal
          createPath={`/classroom/sections/${sectionId}/subjects/${subjectId}/posts`}
          refresh={loadStream}
          allowedTypes={['announcement']}
          onClose={() => setShowNewPost(false)} />
      )}
    </Layout>
  );
}
