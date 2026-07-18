import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, BookOpen, GraduationCap } from 'lucide-react';

interface Classroom {
  section_id: number;
  section_name: string;
  section_label: string;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  subject_code?: string;
  class_teacher_name?: string;
  last_post_title?: string;
  last_post_at?: string;
}

interface CustomClassroom {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  teacher_name?: string | null;
  student_count: number;
  last_post_title?: string | null;
  last_post_at?: string | null;
}

// ── Tiny emoji-by-subject map for the visual cue shown in GC cards ────────────
const EMOJI_FOR_SUBJECT: Record<string, string> = {
  Math: '📐',
  Science: '🧪',
  English: '📖',
  Hindi: '🪔',
  Geography: '🌍',
  History: '🏛',
  'Computer Science': '💻',
  Art: '🎨',
  Music: '🎵',
};

function subjectEmoji(name: string) {
  // exact match first
  if (EMOJI_FOR_SUBJECT[name]) return EMOJI_FOR_SUBJECT[name];
  // partial match
  const key = Object.keys(EMOJI_FOR_SUBJECT).find(k => name.toLowerCase().includes(k.toLowerCase()));
  return key ? EMOJI_FOR_SUBJECT[key] : '📚';
}

export function StudentClasses() {
  const { request } = useApi();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [custom, setCustom] = useState<CustomClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinModal, setJoinModal] = useState(false);

  useEffect(() => {
    Promise.all([
      request<Classroom[]>('/classroom/classes').catch(() => [] as Classroom[]),
      request<CustomClassroom[]>('/classroom/custom-classrooms').catch(() => [] as CustomClassroom[]),
    ]).then(([cls, cust]) => {
      setClasses(cls);
      setCustom(cust);
    }).finally(() => setLoading(false));
  }, [request]);

  const total = classes.length + custom.length;

  return (
    <Layout title="Classroom">
      <div className="max-w-6xl space-y-5">
        {/* Section header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: T.text }}>My Classes</h1>
            <p className="text-xs mt-1" style={{ color: T.textMuted }}>
              {total === 0
                ? 'Your teachers haven\'t set up any classes yet.'
                : `${total} active class${total === 1 ? '' : 'es'}`}
            </p>
          </div>
        </div>

        {/* Class grid */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: T.card }} />)}
          </div>
        )}

        {!loading && total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Custom-named classrooms */}
            {custom.map(c => (
              <button
                key={`custom-${c.id}`}
                onClick={() => navigate(`/student/classroom/custom/${c.id}`)}
                className="group rounded-2xl overflow-hidden text-left transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: T.card, border: `1px solid ${T.border}`, aspectRatio: '16 / 9' }}>
                <div className="relative px-5 py-4" style={{ background: c.color, height: '60%' }}>
                  <div className="absolute inset-0 opacity-15"
                    style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0%, transparent 40%)' }} />
                  <span className="absolute top-3 right-4 text-3xl opacity-90">🎓</span>
                  <div className="relative z-10">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      Custom class
                    </p>
                    <h2 className="text-base font-bold mt-0.5 leading-tight" style={{ color: '#fff' }}>
                      {c.name}
                    </h2>
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between" style={{ height: '40%' }}>
                  <div className="min-w-0">
                    {c.last_post_title ? (
                      <p className="text-xs font-semibold capitalize truncate" style={{ color: T.text }}>{c.last_post_title}</p>
                    ) : (
                      <p className="text-xs" style={{ color: T.textMuted }}>No posts yet</p>
                    )}
                  </div>
                  <div className="text-xs truncate max-w-[40%] flex items-center gap-1" style={{ color: T.textSub }}>
                    {c.teacher_name && <span>by {c.teacher_name}</span>}
                  </div>
                </div>
              </button>
            ))}

            {/* Section × subject classrooms */}
            {classes.map(c => (
              <button
                key={`${c.section_id}-${c.subject_id}`}
                onClick={() => navigate(`/student/classroom/${c.section_id}/${c.subject_id}`)}
                className="group rounded-2xl overflow-hidden text-left transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: T.card, border: `1px solid ${T.border}`, aspectRatio: '16 / 9' }}>
                {/* Colored header band */}
                <div className="relative px-5 py-4"
                  style={{ background: c.subject_color, height: '60%' }}>
                  {/* Faint pattern overlay */}
                  <div className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0%, transparent 40%)',
                    }} />
                  {/* Emoji on top right */}
                  <span className="absolute top-3 right-4 text-3xl opacity-90">
                    {subjectEmoji(c.subject_name)}
                  </span>
                  {/* Class label */}
                  <div className="relative z-10">
                    {c.subject_code && (
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {c.subject_code}
                      </p>
                    )}
                    <h2 className="text-base font-bold mt-0.5 leading-tight" style={{ color: '#fff' }}>
                      {c.section_label} {c.subject_name}
                    </h2>
                  </div>
                </div>
                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between" style={{ height: '40%' }}>
                  <div className="min-w-0">
                    {c.last_post_title ? (
                      <>
                        <p className="text-xs font-semibold capitalize truncate" style={{ color: T.text }}>
                          {c.last_post_title}
                        </p>
                        <p className="text-xs truncate" style={{ color: T.textMuted }}>
                          {c.last_post_at ? new Date(c.last_post_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: T.textMuted }}>No posts yet</p>
                    )}
                  </div>
                  <div className="text-xs truncate max-w-[40%]" style={{ color: T.textSub }}>
                    {c.teacher_name && <span>by {c.teacher_name}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && total === 0 && (
          <div className="rounded-2xl py-16 flex flex-col items-center justify-center"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <GraduationCap size={36} strokeWidth={1.2} style={{ color: T.textMuted }} />
            <p className="text-sm font-semibold mt-3" style={{ color: T.text }}>No classes set up yet</p>
            <p className="text-xs mt-1" style={{ color: T.textMuted }}>
              Your school's tech admin will create classes for each subject you take.
            </p>
          </div>
        )}
      </div>

      {/* Floating "+" join button */}
      <button
        onClick={() => setJoinModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 hover:scale-105 transition-all z-50"
        style={{ background: T.accent, color: '#fff' }}
        title="Join a class">
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {/* Join-class modal (placeholder — full code-join flow can be added later) */}
      {joinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setJoinModal(false); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm space-y-4"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: T.bgDeep }}>
                <BookOpen size={18} style={{ color: T.accent }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: T.text }}>Join a class</h3>
                <p className="text-xs" style={{ color: T.textMuted }}>Enter the class code from your teacher.</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Class code (e.g. 7Z9X4A)"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setJoinModal(false)}
                className="px-3 py-2 rounded-xl text-xs" style={{ color: T.textMuted }}>Cancel</button>
              <button onClick={() => { alert('Code-based join flow comes soon!'); setJoinModal(false); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ background: T.accent, color: '#fff' }}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
