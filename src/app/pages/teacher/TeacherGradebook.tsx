import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Save } from 'lucide-react';

interface MySection { section_id: number; section_name: string; subjects: { id: number; name: string }[]; }
interface Term { id: number; name: string; }
interface StudentRow { student_id: number; student_name: string; roll_number?: string; }

export function TeacherGradebook() {
  const { request } = useApi();
  const [sections, setSections]        = useState<MySection[]>([]);
  const [terms, setTerms]              = useState<Term[]>([]);
  const [selectedSection, setSection]  = useState<number|null>(null);
  const [selectedSubject, setSubject]  = useState<number|null>(null);
  const [selectedTerm, setTerm]        = useState<number|null>(null);
  const [assessment, setAssessment]    = useState('Midterm');
  const [maxMarks, setMaxMarks]        = useState(100);
  const [students, setStudents]        = useState<StudentRow[]>([]);
  const [grades, setGrades]            = useState<Record<number,string>>({});
  const [saving, setSaving]            = useState(false);
  const [saved, setSaved]              = useState(false);

  useEffect(() => {
    Promise.all([
      request<MySection[]>('/teachers/my-sections'),
      request<{ is_current: boolean; terms: Term[] }[]>('/admin/academic-years'),
    ]).then(([s, years]) => {
      setSections(s);
      if (s.length) { setSection(s[0].section_id); setSubject(s[0].subjects[0]?.id ?? null); }
      const cur = years.find(y => y.is_current) ?? years[0];
      if (cur) { setTerms(cur.terms); if (cur.terms.length) setTerm(cur.terms[0].id); }
    }).catch(console.error);
  }, [request]);

  useEffect(() => {
    if (!selectedSection || !selectedSubject || !selectedTerm) return;
    request<{ student_id: number; student_name: string; roll_number?: string; marks: { assessment: string; obtained: number }[] }[]>(
      `/reports/marks/section/${selectedSection}?term_id=${selectedTerm}&subject_id=${selectedSubject}`
    ).then(data => {
      setStudents(data.map(d => ({ student_id: d.student_id, student_name: d.student_name, roll_number: d.roll_number })));
      const ex: Record<number,string> = {};
      for (const d of data) {
        const m = d.marks.find(m => m.assessment === assessment);
        if (m) ex[d.student_id] = String(m.obtained);
      }
      setGrades(ex);
    }).catch(console.error);
  }, [selectedSection, selectedSubject, selectedTerm, assessment, request]);

  const save = async () => {
    if (!selectedSubject || !selectedTerm) return;
    setSaving(true);
    try {
      await request('/reports/marks/bulk', { method: 'POST', body: {
        subject_id: selectedSubject, term_id: selectedTerm,
        assessment_name: assessment, max_marks: maxMarks,
        records: students.map(s => ({ student_id: s.student_id, marks_obtained: parseFloat(grades[s.student_id] ?? '0') || 0 })),
      }});
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const currentSection = sections.find(s => s.section_id === selectedSection);

  return (
    <Layout title="Gradebook">
      <div className="max-w-3xl space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div><Label>Section</Label>
            <Select value={selectedSection ?? ''} onChange={e => setSection(Number(e.target.value))}>
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
            </Select>
          </div>
          <div><Label>Subject</Label>
            <Select value={selectedSubject ?? ''} onChange={e => setSubject(Number(e.target.value))}>
              {(currentSection?.subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={selectedTerm ?? ''} onChange={e => setTerm(Number(e.target.value))}>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div><Label>Assessment</Label>
            <Input value={assessment} onChange={e => setAssessment(e.target.value)} />
          </div>
          <div><Label>Max Marks</Label>
            <Input type="number" value={maxMarks} onChange={e => setMaxMarks(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end">
          <Btn onClick={save} disabled={saving} style={{ background: saved ? T.success : T.accent, color: '#fff' }}>
            <Save size={13} />{saving ? 'Saving…' : saved ? 'Saved!' : 'Save Marks'}
          </Btn>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: T.bgDeep, color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <span>Student</span><span className="text-center">Roll No.</span><span className="text-right">Marks / {maxMarks}</span>
          </div>
          {students.map((s, idx) => (
            <div key={s.student_id} className="grid grid-cols-3 items-center px-4 py-3"
              style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
              <span className="text-xs font-medium" style={{ color: T.text }}>{s.student_name}</span>
              <span className="text-xs text-center" style={{ color: T.textMuted }}>{s.roll_number ?? '—'}</span>
              <div className="flex justify-end">
                <input type="number" min={0} max={maxMarks}
                  value={grades[s.student_id] ?? ''}
                  onChange={e => setGrades(p => ({ ...p, [s.student_id]: e.target.value }))}
                  placeholder="—"
                  className="w-20 text-right px-2 py-1 rounded-lg text-xs outline-none"
                  style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: T.text }} />
              </div>
            </div>
          ))}
          {!students.length && (
            <div className="text-center py-12 text-xs" style={{ color: T.textMuted, background: T.card }}>
              Select a section and subject to enter marks
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
