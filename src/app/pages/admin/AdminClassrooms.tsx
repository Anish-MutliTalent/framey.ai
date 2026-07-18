import { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Select, Label, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import {
  Plus, X, School, Trash2, UserPlus, Search, UserCheck, UserX,
} from 'lucide-react';

interface Classroom {
  id: number;
  section_id: number;
  section_name: string;
  class_name: string;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  academic_year_id: number;
  teacher_id: number | null;
  teacher_name: string | null;
}
interface Section { id: number; name: string; }
interface Subject { id: number; name: string; color: string; }
interface User { id: number; name: string; email: string; }
interface AcademicYear { id: number; name: string; is_current: boolean; }
interface Student {
  id: number;
  user: { id: number; name: string; email: string };
  section: { id: number; name: string };
  roll_number?: string | null;
}
interface CustomClassroom {
  id: number; name: string; description?: string | null; color: string;
  teacher_id?: number | null; teacher_name?: string | null;
  student_count: number;
}

interface StandardForm { section_id: string; subject_id: string; teacher_id: string; }
interface CustomForm { name: string; description: string; color: string; teacher_id: string; student_ids: number[]; }

const COLOR_SWATCHES = ['#4F46E5', '#7C3AED', '#059669', '#D97706', '#0EA5E9', '#EF4444', '#EC4899', '#14B8A6'];

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: on ? T.accent : T.bgDeep, border: `1px solid ${T.border}` }}
      aria-pressed={on}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ClassroomModal({
  mode, setMode,
  form, setForm, customForm, setCustomForm,
  sections, subjects, teachers, students, yearLabel,
  saving, onSave, onClose,
}: {
  mode: 'standard' | 'custom';
  setMode: (m: 'standard' | 'custom') => void;
  form: StandardForm;
  setForm: Dispatch<SetStateAction<StandardForm>>;
  customForm: CustomForm;
  setCustomForm: Dispatch<SetStateAction<CustomForm>>;
  sections: Section[]; subjects: Subject[]; teachers: User[]; students: Student[];
  yearLabel: string;
  saving: boolean; onSave: () => void; onClose: () => void;
}) {
  const [studentQuery, setStudentQuery] = useState('');
  const filteredStudents = students.filter(s =>
    s.user.name.toLowerCase().includes(studentQuery.toLowerCase())
    || (s.roll_number ?? '').toLowerCase().includes(studentQuery.toLowerCase())
  );

  const toggleStudent = (id: number) =>
    setCustomForm(p => ({
      ...p,
      student_ids: p.student_ids.includes(id)
        ? p.student_ids.filter(x => x !== id)
        : [...p.student_ids, id],
    }));

  const standardValid = !!form.section_id && !!form.subject_id && !!form.teacher_id;
  const customValid = !!customForm.name.trim() && !!customForm.teacher_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: '0 8px 28px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl" style={{ background: T.bgDeep }}>
              <School size={16} style={{ color: T.accent }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: T.text }}>New Classroom</h3>
              <p className="text-xs" style={{ color: T.textMuted }}>
                {mode === 'custom' ? 'A named class with a custom roster.' : 'Assign a teacher to a (section, subject) pair.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: T.text }}>Custom-named classroom</p>
            <p className="text-xs" style={{ color: T.textMuted }}>Free-form name instead of section × subject.</p>
          </div>
          <Toggle on={mode === 'custom'} onChange={() => setMode(mode === 'custom' ? 'standard' : 'custom')} />
        </div>

        {mode === 'standard' ? (
          <div className="space-y-3">
            <div>
              <Label>Section</Label>
              <Select value={form.section_id} onChange={e => setForm(p => ({ ...p, section_id: e.target.value }))}>
                <option value="">— Select section —</option>
                {sections.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={form.subject_id} onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}>
                <option value="">— Select subject —</option>
                {subjects.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={form.teacher_id} onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))}>
                <option value="">— Select teacher —</option>
                {teachers.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </Select>
            </div>
            <div className="text-xs flex items-center gap-2" style={{ color: T.textMuted }}>
              Academic year: <span className="font-medium" style={{ color: T.text }}>{yearLabel}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Class name</Label>
              <input type="text" value={customForm.name}
                onChange={e => setCustomForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Robotics Club, Advanced Math Lab"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <input type="text" value={customForm.description}
                onChange={e => setCustomForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Short description"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map(c => (
                  <button key={c} type="button" onClick={() => setCustomForm(p => ({ ...p, color: c }))}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, border: customForm.color === c ? '2px solid ' + T.text : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={customForm.teacher_id}
                onChange={e => setCustomForm(p => ({ ...p, teacher_id: e.target.value }))}>
                <option value="">— Select teacher —</option>
                {teachers.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Students ({customForm.student_ids.length} selected)</Label>
              <input type="text" value={studentQuery} onChange={e => setStudentQuery(e.target.value)}
                placeholder="Search students…"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-2"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }} />
              <div className="max-h-40 overflow-y-auto rounded-xl" style={{ border: `1px solid ${T.border}` }}>
                {filteredStudents.length === 0 && (
                  <p className="text-xs px-3 py-3" style={{ color: T.textMuted }}>No students found.</p>
                )}
                {filteredStudents.map(s => {
                  const checked = customForm.student_ids.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleStudent(s.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                      style={{ background: checked ? T.accent + '14' : T.card, borderTop: `1px solid ${T.border}` }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ background: checked ? T.accent : T.bgDeep, border: `1px solid ${T.border}` }}>
                        {checked && <UserCheck size={11} style={{ color: '#fff' }} />}
                      </span>
                      <span className="text-xs font-medium flex-1 truncate" style={{ color: T.text }}>{s.user.name}</span>
                      <span className="text-xs shrink-0" style={{ color: T.textMuted }}>{s.section.name}{s.roll_number ? ` · ${s.roll_number}` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-xs flex items-center gap-2" style={{ color: T.textMuted }}>
              Academic year: <span className="font-medium" style={{ color: T.text }}>{yearLabel}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={onSave} disabled={saving || (mode === 'standard' ? !standardValid : !customValid)}>
            {saving ? 'Creating…' : 'Create Classroom'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function AdminClassrooms() {
  const { request } = useApi();
  const [classes, setClasses]         = useState<Classroom[]>([]);
  const [custom, setCustom]           = useState<CustomClassroom[]>([]);
  const [sections, setSections]       = useState<Section[]>([]);
  const [subjects, setSubjects]       = useState<Subject[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [students, setStudents]       = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading]         = useState(true);

  const [showModal, setShowModal]     = useState(false);
  const [modalMode, setModalMode]     = useState<'standard' | 'custom'>('standard');
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<'all' | 'assigned' | 'unassigned'>('all');

  const [form, setForm] = useState<StandardForm>({ section_id: '', subject_id: '', teacher_id: '' });
  const [customForm, setCustomForm] = useState<CustomForm>({ name: '', description: '', color: COLOR_SWATCHES[0], teacher_id: '', student_ids: [] });
  const [saving, setSaving]           = useState(false);
  const [reassignFor, setReassignFor] = useState<Classroom | null>(null);

  const load = async () => {
    try {
      const [cls, classesRaw, subjects, users, years, cust, studs] = await Promise.all([
        request<Classroom[]>('/admin/classrooms'),
        request<{ id: number; name: string; sections: Section[] }[]>('/admin/classes'),
        request<Subject[]>('/admin/subjects'),
        request<User[]>('/admin/users'),
        request<AcademicYear[]>('/admin/academic-years'),
        request<CustomClassroom[]>('/classroom/custom-classrooms'),
        request<Student[]>('/admin/students'),
      ]);
      setClasses(cls);
      setSections(classesRaw.flatMap(c => c.sections.map(s => ({ ...s, name: `${c.name} ${s.name}` }))));
      setSubjects(subjects);
      setUsers(users);
      setCurrentYear(years.find(y => y.is_current) ?? years[0] ?? null);
      setCustom(cust);
      setStudents(studs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const teachers = users; // all users; backend validates teacher role on create

  const openModal = () => {
    setForm({ section_id: '', subject_id: '', teacher_id: '' });
    setCustomForm({ name: '', description: '', color: COLOR_SWATCHES[0], teacher_id: '', student_ids: [] });
    setModalMode('standard');
    setShowModal(true);
  };

  const create = async () => {
    if (!currentYear) return;
    setSaving(true);
    try {
      if (modalMode === 'custom') {
        if (!customForm.name.trim() || !customForm.teacher_id) return;
        await request('/classroom/custom-classrooms', {
          method: 'POST',
          body: {
            name: customForm.name.trim(),
            description: customForm.description || null,
            color: customForm.color,
            teacher_id: Number(customForm.teacher_id),
            academic_year_id: currentYear.id,
            student_ids: customForm.student_ids,
          },
        });
      } else {
        if (!form.section_id || !form.subject_id || !form.teacher_id) return;
        await request('/admin/classrooms', {
          method: 'POST',
          body: {
            section_id: Number(form.section_id),
            subject_id: Number(form.subject_id),
            teacher_id: Number(form.teacher_id),
            academic_year_id: currentYear.id,
          },
        });
        const cls = await request<Classroom[]>('/admin/classrooms');
        setClasses(cls);
      }
      setShowModal(false);
      // Refresh custom list too
      const cust = await request<CustomClassroom[]>('/classroom/custom-classrooms');
      setCustom(cust);
    } finally { setSaving(false); }
  };

  const reassign = async (classroomId: number, teacherId: number, existingSectionId: number, existingSubjectId: number) => {
    if (classroomId === 0 || !currentYear) {
      await request('/admin/classrooms', {
        method: 'POST',
        body: { section_id: existingSectionId, subject_id: existingSubjectId, teacher_id: teacherId, academic_year_id: currentYear.id },
      });
    } else {
      await request(`/admin/classrooms/${classroomId}`, { method: 'PATCH', body: { teacher_id: teacherId } });
    }
    setReassignFor(null);
    const cls = await request<Classroom[]>('/admin/classrooms');
    setClasses(cls);
  };

  const unassign = async (classroomId: number) => {
    await request(`/admin/classrooms/${classroomId}`, { method: 'PATCH', body: { teacher_id: 0 } });
    setReassignFor(null);
    const cls = await request<Classroom[]>('/admin/classrooms');
    setClasses(cls);
  };

  const remove = async (classroomId: number) => {
    if (!confirm('Delete this classroom? The teacher assignment will be removed.')) return;
    await request(`/admin/classrooms/${classroomId}`, { method: 'DELETE' });
    const cls = await request<Classroom[]>('/admin/classrooms');
    setClasses(cls);
  };

  const removeCustom = async (id: number) => {
    if (!confirm('Delete this custom classroom? All its posts and submissions will be removed.')) return;
    await request(`/classroom/custom-classrooms/${id}`, { method: 'DELETE' });
    const cust = await request<CustomClassroom[]>('/classroom/custom-classrooms');
    setCustom(cust);
  };

  const filtered = classes.filter(c => {
    if (filter === 'assigned' && !c.teacher_id) return false;
    if (filter === 'unassigned' && c.teacher_id) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.section_name.toLowerCase().includes(q)
        || c.subject_name.toLowerCase().includes(q)
        || (c.teacher_name ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const assignedCount = classes.filter(c => c.teacher_id).length;

  return (
    <Layout title="Classrooms">
      <div className="max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: T.text }}>Classrooms</h1>
            <p className="text-xs mt-1" style={{ color: T.textMuted }}>
              {assignedCount} of {classes.length} section×subject classrooms assigned
              {custom.length > 0 && ` · ${custom.length} custom classroom${custom.length === 1 ? '' : 's'}`}
              {currentYear && ` · ${currentYear.name}`}.
            </p>
          </div>
          <Btn onClick={openModal}>
            <Plus size={13} /> New Classroom
          </Btn>
        </div>

        {/* Custom classrooms */}
        {custom.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>
              Custom classrooms
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {custom.map(c => (
                <div key={c.id} className="group rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: T.text }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: T.textMuted }}>
                      {c.teacher_name ? `${c.teacher_name} · ` : ''}{c.student_count} student{c.student_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button onClick={() => removeCustom(c.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    style={{ color: T.danger }} title="Delete custom classroom">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5" style={{ color: T.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search section / subject / teacher…"
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
          </div>
          <div className="flex gap-1 p-1 rounded-xl"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
            {(['all', 'assigned', 'unassigned'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all"
                style={filter === f ? { background: T.card, color: T.text, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : { color: T.textMuted }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Section × subject table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {loading && (
            <div className="p-8 text-center text-xs" style={{ color: T.textMuted }}>Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <Empty text="No classrooms match the current filter." />
          )}
          {!loading && filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: T.bgDeep, color: T.textMuted }}>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Section</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Subject</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Teacher</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider w-px">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={`${c.section_id}-${c.subject_id}`} className="group"
                    style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: T.text }}>{c.section_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: c.subject_color }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: c.subject_color }} />
                        {c.subject_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.teacher_id && c.teacher_name ? (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: T.success }}>
                          <UserCheck size={12} /> {c.teacher_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: T.warning }}>
                          <UserX size={12} /> Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {reassignFor?.section_id === c.section_id && reassignFor?.subject_id === c.subject_id ? (
                          <>
                            <select autoFocus
                              value=""
                              onChange={e => { if (e.target.value) reassign(c.id, Number(e.target.value), c.section_id, c.subject_id); }}
                              className="px-2 py-1 rounded-lg text-xs outline-none"
                              style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.text }}>
                              <option value="">Reassign…</option>
                              {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                            </select>
                            {c.id > 0 && (
                              <button onClick={() => unassign(c.id)}
                                className="px-2 py-1 rounded-lg text-xs"
                                style={{ color: T.warning, border: `1px solid ${T.border}` }}>
                                Unassign
                              </button>
                            )}
                            <button onClick={() => setReassignFor(null)}
                              className="px-2 py-1 rounded-lg text-xs"
                              style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setReassignFor(c)}
                              className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                              style={{ color: T.textSub }}
                              title="Reassign teacher">
                              <UserPlus size={13} />
                            </button>
                            {c.id > 0 && (
                              <button onClick={() => remove(c.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                style={{ color: T.danger }}
                                title="Delete classroom">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && currentYear && (
        <ClassroomModal
          mode={modalMode}
          setMode={setModalMode}
          form={form}
          setForm={setForm}
          customForm={customForm}
          setCustomForm={setCustomForm}
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          students={students}
          yearLabel={currentYear.name}
          saving={saving}
          onSave={create}
          onClose={() => setShowModal(false)}
        />
      )}
    </Layout>
  );
}
