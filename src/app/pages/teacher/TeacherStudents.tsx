import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import {
  ChevronDown, ChevronRight, BookMarked, TrendingUp,
  FolderKanban, CheckCircle2, Circle, BarChart2, Activity,
} from 'lucide-react';

interface MySection { section_id: number; section_name: string; }

interface Student {
  id: number;
  user: { name: string; email: string; avatar_url?: string };
  roll_number?: string;
}

interface DiaryEntry {
  id: number; title: string; description?: string;
  due_date?: string; subject?: { name: string; color: string }; is_completed: boolean;
}

interface ProgressLog {
  id: number; activity: string; subject: string;
  duration_minutes: number; mastery_score?: number; created_at: string;
}

interface Project {
  id: number; title: string; subject: string; status: string; updated_at?: string;
}

interface StudentDetail {
  diary: DiaryEntry[];
  progress: ProgressLog[];
  projects: Project[];
}

interface MedicalCondition {
  id: number; student_id: number; condition: string; notes?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  'In Progress': T.accent, 'Review': T.warning, 'Completed': T.success, 'Final': T.textMuted,
};

export function TeacherStudents() {
  const { request } = useApi();
  const [sections, setSections] = useState<MySection[]>([]);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, StudentDetail>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [conditions, setConditions] = useState<MedicalCondition[]>([]);

  useEffect(() => {
    request<MySection[]>('/teachers/my-sections').then(s => {
      setSections(s);
      if (s.length > 0) setSelectedSection(s[0].section_id);
    }).catch(console.error);
    request<MedicalCondition[]>('/wellness/conditions').then(setConditions).catch(() => {});
  }, [request]);

  useEffect(() => {
    if (!selectedSection) return;
    setLoadingStudents(true);
    setExpanded(null);
    request<Student[]>(`/admin/students?section_id=${selectedSection}`)
      .then(setStudents).catch(console.error).finally(() => setLoadingStudents(false));
  }, [selectedSection, request]);

  const toggleStudent = async (studentId: number) => {
    if (expanded === studentId) { setExpanded(null); return; }
    setExpanded(studentId);
    if (detail[studentId]) return; // already loaded

    setLoadingDetail(studentId);
    try {
      const data = await request<StudentDetail>(`/teachers/student/${studentId}/overview`);
      setDetail(prev => ({ ...prev, [studentId]: data }));
    } catch (e) {
      console.error(e);
    } finally { setLoadingDetail(null); }
  };

  const currentSection = sections.find(s => s.section_id === selectedSection);

  return (
    <Layout title="My Students">
      <div className="max-w-3xl space-y-5">
        {/* Section selector */}
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>Section</label>
            <select value={selectedSection ?? ''} onChange={e => setSelectedSection(Number(e.target.value))}
              className="px-3 py-2 rounded-xl text-sm outline-none appearance-none"
              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}>
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
            </select>
          </div>
          {currentSection && (
            <div className="mt-5">
              <span className="text-xs" style={{ color: T.textMuted }}>
                {students.length} student{students.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Student list */}
        {loadingStudents && (
          <div className="animate-pulse space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl" style={{ background: T.bgDeep }} />)}
          </div>
        )}

        {!loadingStudents && students.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: T.textMuted }}>
            No students in this section.
          </div>
        )}

        <div className="space-y-2">
          {students.map(student => {
            const isOpen = expanded === student.id;
            const d = detail[student.id];
            const isLoading = loadingDetail === student.id;

            return (
              <div key={student.id} className="rounded-2xl overflow-hidden"
                style={{ background: T.card, border: `1px solid ${T.border}` }}>
                {/* Student row */}
                <button onClick={() => toggleStudent(student.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors">
                  {student.user?.avatar_url
                    ? <img src={student.user.avatar_url} className="w-9 h-9 rounded-full shrink-0" alt="" />
                    : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: T.accentBg, color: T.accent }}>
                        {student.user?.name?.[0] ?? '?'}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: T.text }}>
                      {student.user?.name ?? 'Unknown'}
                    </div>
                    <div className="text-xs" style={{ color: T.textMuted }}>
                      {student.roll_number ? `Roll ${student.roll_number}` : ''} {student.user?.email}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={16} style={{ color: T.textMuted }} /> : <ChevronRight size={16} style={{ color: T.textMuted }} />}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${T.border}`, background: T.bg }}>
                    {isLoading && (
                      <div className="p-6 animate-pulse space-y-2">
                        {[1,2].map(i => <div key={i} className="h-10 rounded-xl" style={{ background: T.bgDeep }} />)}
                      </div>
                    )}
                    {d && (
                      <div className="p-5 space-y-5">

                        {/* Diary / Homework */}
                        <Section title="Diary & Homework" icon={<BookMarked size={14} style={{ color: T.warning }} />} count={d.diary.length}>
                          {d.diary.length === 0
                            ? <p className="text-xs" style={{ color: T.textMuted }}>No diary entries.</p>
                            : d.diary.slice(0, 5).map(e => (
                              <div key={e.id} className="flex items-start gap-2 py-2"
                                style={{ borderBottom: `1px solid ${T.border}` }}>
                                <span style={{ color: e.is_completed ? T.success : T.textMuted }} className="mt-0.5 shrink-0">
                                  {e.is_completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                                </span>
                                <div className="min-w-0">
                                  <p className={`text-xs font-medium ${e.is_completed ? 'line-through' : ''}`}
                                    style={{ color: e.is_completed ? T.textMuted : T.text }}>
                                    {e.title}
                                  </p>
                                  {e.due_date && (
                                    <p className="text-xs" style={{ color: T.textMuted }}>
                                      Due {new Date(e.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                                {e.subject && (
                                  <span className="ml-auto text-xs shrink-0 px-1.5 py-0.5 rounded-full"
                                    style={{ background: `${e.subject.color}15`, color: e.subject.color }}>
                                    {e.subject.name}
                                  </span>
                                )}
                              </div>
                            ))
                          }
                        </Section>

                        {/* Progress */}
                        <Section title="Learning Progress" icon={<TrendingUp size={14} style={{ color: T.info }} />} count={d.progress.length}>
                          {d.progress.length === 0
                            ? <p className="text-xs" style={{ color: T.textMuted }}>No activity logged.</p>
                            : (
                              <>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  {[
                                    { label: 'Sessions', value: d.progress.length },
                                    { label: 'Total Mins', value: d.progress.reduce((a, l) => a + l.duration_minutes, 0) },
                                    {
                                      label: 'Avg Mastery',
                                      value: d.progress.filter(l => l.mastery_score).length
                                        ? Math.round(d.progress.filter(l => l.mastery_score).reduce((a, l) => a + (l.mastery_score ?? 0), 0) / d.progress.filter(l => l.mastery_score).length) + '%'
                                        : '—'
                                    },
                                  ].map(s => (
                                    <div key={s.label} className="rounded-xl p-3 text-center"
                                      style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                      <div className="text-base font-bold" style={{ color: T.text }}>{s.value}</div>
                                      <div className="text-xs" style={{ color: T.textMuted }}>{s.label}</div>
                                    </div>
                                  ))}
                                </div>
                                {d.progress.slice(0, 3).map(l => (
                                  <div key={l.id} className="flex items-center justify-between py-1.5"
                                    style={{ borderBottom: `1px solid ${T.border}` }}>
                                    <div>
                                      <p className="text-xs font-medium" style={{ color: T.text }}>{l.activity}</p>
                                      <p className="text-xs" style={{ color: T.textMuted }}>{l.subject || 'General'}</p>
                                    </div>
                                    <div className="text-right text-xs">
                                      <div style={{ color: T.textSub }}>{l.duration_minutes} min</div>
                                      {l.mastery_score != null && <div style={{ color: T.textMuted }}>{l.mastery_score}%</div>}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )
                          }
                        </Section>

                        {/* Projects */}
                        <Section title="Projects" icon={<FolderKanban size={14} style={{ color: '#7C3AED' }} />} count={d.projects.length}>
                          {d.projects.length === 0
                            ? <p className="text-xs" style={{ color: T.textMuted }}>No projects created.</p>
                            : d.projects.slice(0, 4).map(p => (
                              <div key={p.id} className="flex items-center justify-between py-2"
                                style={{ borderBottom: `1px solid ${T.border}` }}>
                                <div>
                                  <p className="text-xs font-medium" style={{ color: T.text }}>{p.title}</p>
                                  <p className="text-xs" style={{ color: T.textMuted }}>{p.subject || 'No subject'}</p>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: `${STATUS_COLOR[p.status] ?? T.accent}15`, color: STATUS_COLOR[p.status] ?? T.accent }}>
                                  {p.status}
                                </span>
                              </div>
                            ))
                          }
                        </Section>

                        {/* Medical conditions */}
                        <Section title="Medical Conditions" icon={<Activity size={14} style={{ color: T.warning }} />} count={conditions.filter(c => c.student_id === student.id).length}>
                          {conditions.filter(c => c.student_id === student.id).length === 0
                            ? <p className="text-xs" style={{ color: T.textMuted }}>No medical conditions listed.</p>
                            : (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {conditions.filter(c => c.student_id === student.id).map(c => (
                                  <div key={c.id} className="px-2.5 py-1 rounded-full text-xs font-medium"
                                    style={{ background: T.warningBg, color: T.warning, border: `1px solid ${T.warning}40` }}
                                    title={c.notes || undefined}>
                                    {c.condition}
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        </Section>

                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function Section({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>{title}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
          style={{ background: T.bgDeep, color: T.textMuted }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}
