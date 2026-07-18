import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { GraduationCap, BookOpen, Users } from 'lucide-react';

interface Classroom {
  section_id: number;
  section_name: string;
  section_label: string;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  subject_code?: string;
  class_teacher_name?: string;
  teacher_name: string;
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
  if (EMOJI_FOR_SUBJECT[name]) return EMOJI_FOR_SUBJECT[name];
  const k = Object.keys(EMOJI_FOR_SUBJECT).find(x => name.toLowerCase().includes(x.toLowerCase()));
  return k ? EMOJI_FOR_SUBJECT[k] : '📚';
}

export function TeacherClasses() {
  const { request } = useApi();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [custom, setCustom] = useState<CustomClassroom[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div>
          <h1 className="text-xl font-bold" style={{ color: T.text }}>My Classes</h1>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>
            Classes you teach — click any to manage stream, classwork, and people.
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: T.card }} />)}
          </div>
        )}

        {!loading && total === 0 && (
          <div className="rounded-2xl py-16 flex flex-col items-center justify-center"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <GraduationCap size={36} strokeWidth={1.2} style={{ color: T.textMuted }} />
            <p className="text-sm font-semibold mt-3" style={{ color: T.text }}>No classes assigned yet</p>
            <p className="text-xs mt-1" style={{ color: T.textMuted }}>
              Ask your tech admin to assign you to a (section × subject) classroom.
            </p>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Custom-named classrooms */}
            {custom.map(c => (
              <button
                key={`custom-${c.id}`}
                onClick={() => navigate(`/teacher/classroom/custom/${c.id}`)}
                className="rounded-2xl overflow-hidden text-left transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: T.card, border: `1px solid ${T.border}`, aspectRatio: '16 / 9' }}>
                <div className="relative px-5 py-4" style={{ background: c.color, height: '60%' }}>
                  <div className="absolute inset-0 opacity-15"
                    style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0%, transparent 40%)' }} />
                  <span className="absolute top-3 right-4 text-3xl opacity-90">🎓</span>
                  <div className="relative z-10">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>Custom class</p>
                    <h2 className="text-base font-bold mt-0.5 leading-tight" style={{ color: '#fff' }}>{c.name}</h2>
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between" style={{ height: '40%' }}>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: T.textSub }}>
                    <BookOpen size={12} /> {c.last_post_title || 'No posts yet'}
                  </div>
                  <span className="flex items-center gap-1 text-xs" style={{ color: T.textMuted }}>
                    <Users size={11} /> {c.student_count}
                  </span>
                </div>
              </button>
            ))}

            {/* Section × subject classrooms */}
            {classes.map(c => (
              <button
                key={`${c.section_id}-${c.subject_id}`}
                onClick={() => navigate(`/teacher/classroom/${c.section_id}/${c.subject_id}`)}
                className="rounded-2xl overflow-hidden text-left transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: T.card, border: `1px solid ${T.border}`, aspectRatio: '16 / 9' }}>
                <div className="relative px-5 py-4" style={{ background: c.subject_color, height: '60%' }}>
                  <div className="absolute inset-0 opacity-15"
                    style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.5) 0%, transparent 40%)' }} />
                  <span className="absolute top-3 right-4 text-3xl opacity-90">{subjectEmoji(c.subject_name)}</span>
                  <div className="relative z-10">
                    {c.subject_code && (
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.subject_code}</p>
                    )}
                    <h2 className="text-base font-bold mt-0.5 leading-tight" style={{ color: '#fff' }}>
                      {c.section_label} {c.subject_name}
                    </h2>
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between" style={{ height: '40%' }}>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: T.textSub }}>
                    <BookOpen size={12} /> {c.last_post_title || 'No posts yet'}
                  </div>
                  {c.last_post_at && (
                    <span className="text-xs" style={{ color: T.textMuted }}>
                      {new Date(c.last_post_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
