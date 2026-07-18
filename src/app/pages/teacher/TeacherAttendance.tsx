import { useEffect, useState, ReactNode } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { useAuth, API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';
import { CheckCircle2, XCircle, Clock, Save, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface MySection { section_id: number; section_name: string; }
interface StudentRow {
  student_id: number;
  student_name: string;
  roll_number?: string;
  avatar_url?: string;
  attendance_id?: number;
  status: string;
  remarks?: string;
}

type Status = 'present' | 'absent' | 'half_day';

const STATUS_CFG: Record<Status, { label: string; color: string; icon: ReactNode }> = {
  present:  { label: 'Present',  color: T.success, icon: <CheckCircle2 size={14} /> },
  absent:   { label: 'Absent',   color: T.danger,  icon: <XCircle size={14} /> },
  half_day: { label: 'Half Day', color: T.warning, icon: <Clock size={14} /> },
};

function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

export function TeacherAttendance() {
  const { request } = useApi();
  const { token } = useAuth();
  const [sections, setSections]   = useState<MySection[]>([]);
  const [selected, setSelected]   = useState<number | null>(null);
  const [date, setDate]           = useState(fmt(new Date()));
  const [students, setStudents]   = useState<StudentRow[]>([]);
  const [att, setAtt]             = useState<Record<number, Status>>({});
  const [remarks, setRemarks]     = useState<Record<number, string>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [certs, setCerts]         = useState<any[]>([]);

  const loadCerts = () => request<any[]>('/wellness/certificates').then(setCerts).catch(() => {});
  useEffect(() => { loadCerts(); }, [request]);

  const reviewCert = async (id: number, status: 'approved' | 'declined') => {
    const comment = status === 'declined' ? prompt('Reason for declining (optional):') ?? '' : '';
    try {
      await request(`/wellness/certificates/${id}/review`, { method: 'PATCH', body: { status, teacher_comment: comment || null } });
      await loadCerts();
    } catch (e) { alert((e as Error).message || 'Failed'); }
  };

  useEffect(() => {
    request<MySection[]>('/teachers/my-sections')
      .then(s => { setSections(s); if (s.length) setSelected(s[0].section_id); })
      .catch(console.error);
  }, [request]);

  useEffect(() => {
    if (!selected) return;
    request<StudentRow[]>(`/attendance/section/${selected}?date_str=${date}`)
      .then(data => {
        setStudents(data);
        const m: Record<number, Status> = {};
        const r: Record<number, string> = {};
        for (const s of data) {
          if (s.status !== 'unmarked') m[s.student_id] = s.status as Status;
          if (s.remarks) r[s.student_id] = s.remarks;
        }
        setAtt(m);
        setRemarks(r);
      })
      .catch(console.error);
  }, [selected, date, request]);

  const setAll = (status: Status) => {
    const m: Record<number, Status> = {};
    for (const s of students) m[s.student_id] = status;
    setAtt(m);
  };

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(fmt(d));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await request('/attendance/day', {
        method: 'POST',
        body: {
          section_id: selected,
          date,
          records: students.map(s => ({
            student_id: s.student_id,
            status: att[s.student_id] ?? 'absent',
            remarks: remarks[s.student_id] ?? null,
          })),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Count summary
  const counts = { present: 0, absent: 0, half_day: 0, unmarked: 0 };
  for (const s of students) {
    const st = att[s.student_id];
    if (st) counts[st]++;
    else counts.unmarked++;
  }

  return (
    <Layout title="Attendance">
      <div className="max-w-2xl space-y-5">

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {sections.length > 1 && (
            <Select value={selected ?? ''} onChange={e => setSelected(Number(e.target.value))} className="w-auto">
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
            </Select>
          )}

          {/* Date navigator */}
          <div className="flex items-center gap-1 rounded-xl overflow-hidden"
            style={{ border: `1px solid ${T.border}` }}>
            <button onClick={() => shiftDate(-1)}
              className="px-3 py-2 hover:bg-stone-100 transition-colors"
              style={{ color: T.textMuted }}>
              <ChevronLeft size={15} />
            </button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-2 py-2 text-xs outline-none"
              style={{ background: T.card, color: T.text, minWidth: 0 }} />
            <button onClick={() => shiftDate(1)}
              className="px-3 py-2 hover:bg-stone-100 transition-colors"
              style={{ color: T.textMuted }}>
              <ChevronRight size={15} />
            </button>
          </div>

          <Btn onClick={save} disabled={saving}
            style={{ background: saved ? T.success : T.accent, color: '#fff', marginLeft: 'auto' }}>
            <Save size={13} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </Btn>
        </div>

        {/* Date label */}
        <div>
          <h2 className="text-sm font-semibold" style={{ color: T.text }}>{dayLabel}</h2>
          <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
            {sections.find(s => s.section_id === selected)?.section_name}
          </p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(counts) as [string, number][])
            .filter(([k]) => k !== 'unmarked')
            .map(([status, count]) => {
              const cfg = STATUS_CFG[status as Status];
              return (
                <span key={status} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: `${cfg.color}12`, color: cfg.color }}>
                  {cfg.icon} {count} {cfg.label}
                </span>
              );
            })}
          {counts.unmarked > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
              style={{ background: T.bgDeep, color: T.textMuted }}>
              {counts.unmarked} unmarked
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: T.textMuted }}>Mark all:</span>
          {(Object.entries(STATUS_CFG) as [Status, typeof STATUS_CFG[Status]][]).map(([status, cfg]) => (
            <button key={status} onClick={() => setAll(status)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        {/* Student roster */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {students.map((student, idx) => {
            const cur = att[student.student_id];
            const cfg = cur ? STATUS_CFG[cur] : null;
            return (
              <div key={student.student_id}
                className="px-4 py-3 transition-colors"
                style={{
                  background: idx % 2 === 0 ? T.card : T.bg,
                  borderBottom: `1px solid ${T.border}`,
                }}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {student.avatar_url
                    ? <img src={student.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="" />
                    : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: cfg ? `${cfg.color}20` : T.bgDeep, color: cfg?.color ?? T.textMuted }}>
                        {student.student_name[0]}
                      </div>
                  }

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: T.text }}>{student.student_name}</div>
                    {student.roll_number && (
                      <div className="text-xs" style={{ color: T.textMuted }}>Roll {student.roll_number}</div>
                    )}
                  </div>

                  {/* Status buttons */}
                  <div className="flex gap-1.5 shrink-0">
                    {(Object.entries(STATUS_CFG) as [Status, typeof STATUS_CFG[Status]][]).map(([status, scfg]) => (
                      <button key={status}
                        onClick={() => setAtt(p => ({ ...p, [student.student_id]: status }))}
                        title={scfg.label}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: cur === status ? `${scfg.color}18` : T.bgDeep,
                          color: cur === status ? scfg.color : T.textMuted,
                          border: `1px solid ${cur === status ? scfg.color + '50' : 'transparent'}`,
                        }}>
                        {scfg.icon}
                        <span className="hidden sm:inline">{scfg.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remarks field — only show when absent or half_day */}
                {(cur === 'absent' || cur === 'half_day') && (
                  <div className="mt-2 ml-11">
                    <input
                      type="text"
                      value={remarks[student.student_id] ?? ''}
                      onChange={e => setRemarks(p => ({ ...p, [student.student_id]: e.target.value }))}
                      placeholder="Remarks (optional)"
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                      style={{
                        background: T.input,
                        border: `1px solid ${T.inputBorder}`,
                        color: T.text,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {!students.length && (
            <div className="text-center py-12 text-xs" style={{ color: T.textMuted, background: T.card }}>
              Select a section to mark attendance
            </div>
          )}
        </div>

        {/* Medical certificates to review */}
        {selected && (() => {
          const sectionStudentIds = new Set(students.map(s => s.student_id));
          const sectionCerts = certs.filter(c => sectionStudentIds.has(c.student_id));
          const certUrl = (id: number) => `${API_BASE}/wellness/certificates/${id}/raw${token ? `?token=${token}` : ''}`;
          const pending = sectionCerts.filter(c => c.status === 'pending');
          return (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: T.bgDeep, borderBottom: `1px solid ${T.border}` }}>
                <FileText size={14} style={{ color: T.textMuted }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Medical Certificates</span>
                {pending.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: T.warningBg, color: T.warning }}>
                    {pending.length} to review
                  </span>
                )}
              </div>
              {sectionCerts.length === 0 ? (
                <div className="p-6 text-center text-xs" style={{ color: T.textMuted, background: T.card }}>
                  No medical certificates from students in this section.
                </div>
              ) : (
                <div className="space-y-2 p-3" style={{ background: T.card }}>
                  {sectionCerts.map(c => {
                    const isPending = c.status === 'pending';
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
                        <a href={certUrl(c.id)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 min-w-0 flex-1"
                          style={{ color: T.text }}>
                          <FileText size={13} style={{ color: T.textSub }} />
                          <span className="truncate">{c.original_name}</span>
                        </a>
                        <div className="text-xs shrink-0" style={{ color: T.textMuted }}>
                          {students.find(s => s.student_id === c.student_id)?.student_name ?? 'Student'} · {' '}
                          {new Date(c.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {c.end_date && c.end_date !== c.start_date ? `–${new Date(c.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </div>
                        {c.status === 'approved' && <span className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: T.success }}><CheckCircle2 size={12} /> Approved</span>}
                        {c.status === 'declined' && <span className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: T.danger }}><XCircle size={12} /> Declined</span>}
                        {isPending && (
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => reviewCert(c.id, 'approved')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                              style={{ background: T.successBg, color: T.success, border: `1px solid ${T.success}40` }}>
                              <CheckCircle2 size={11} /> Approve
                            </button>
                            <button onClick={() => reviewCert(c.id, 'declined')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                              style={{ background: T.dangerBg, color: T.danger, border: `1px solid ${T.danger}40` }}>
                              <XCircle size={11} /> Decline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </Layout>
  );
}
