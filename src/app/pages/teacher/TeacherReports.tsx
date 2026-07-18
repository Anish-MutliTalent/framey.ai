import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Select, Btn, Label, Textarea, Modal, Empty } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { BarChart2 } from 'lucide-react';

interface MySection { section_id: number; section_name: string; }
interface Term { id: number; name: string; }
interface StudentMark { student_id: number; student_name: string; roll_number?: string; marks: { subject: string; assessment: string; obtained: number; max: number }[]; }

export function TeacherReports() {
  const { request } = useApi();
  const [sections, setSections]  = useState<MySection[]>([]);
  const [terms, setTerms]        = useState<Term[]>([]);
  const [selected, setSelected]  = useState<number | null>(null);
  const [term, setTerm]          = useState<number | null>(null);
  const [data, setData]          = useState<StudentMark[]>([]);
  const [loading, setLoading]    = useState(false);
  const [remarkForm, setRemarkForm] = useState<{ student_id: number; content: string } | null>(null);

  useEffect(() => {
    Promise.all([
      request<MySection[]>('/teachers/my-sections'),
      request<{ is_current: boolean; terms: Term[] }[]>('/admin/academic-years'),
    ]).then(([secs, years]) => {
      setSections(secs); if (secs.length) setSelected(secs[0].section_id);
      const cur = years.find(y => y.is_current) ?? years[0];
      if (cur) { setTerms(cur.terms); if (cur.terms.length) setTerm(cur.terms[0].id); }
    }).catch(console.error);
  }, [request]);

  useEffect(() => {
    if (!selected || !term) return;
    setLoading(true);
    request<StudentMark[]>(`/reports/marks/section/${selected}?term_id=${term}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [selected, term, request]);

  const addRemark = async (studentId: number, content: string) => {
    await request('/reports/remarks', { method: 'POST', body: { student_id: studentId, term_id: term, content } });
    setRemarkForm(null);
  };

  return (
    <Layout title="Reports">
      <div className="max-w-4xl space-y-5">
        <div className="flex gap-3">
          <Select value={selected ?? ''} onChange={e => setSelected(Number(e.target.value))} className="w-auto">
            {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
          </Select>
          <Select value={term ?? ''} onChange={e => setTerm(Number(e.target.value))} className="w-auto">
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: T.bgDeep, color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <span className="col-span-4">Student</span>
            <span className="col-span-6">Assessments</span>
            <span className="col-span-2 text-right">Action</span>
          </div>
          {data.map((student, idx) => (
            <div key={student.student_id} className="grid grid-cols-12 items-start px-4 py-3"
              style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
              <div className="col-span-4">
                <div className="text-xs font-semibold" style={{ color: T.text }}>{student.student_name}</div>
                {student.roll_number && <div className="text-xs" style={{ color: T.textMuted }}>Roll {student.roll_number}</div>}
              </div>
              <div className="col-span-6">
                {student.marks.length === 0
                  ? <span className="text-xs" style={{ color: T.textMuted }}>No marks</span>
                  : <div className="flex flex-wrap gap-1.5">
                    {student.marks.map((m, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: T.bgDeep, color: T.textSub }}>
                        {m.subject} · {m.assessment}: {m.obtained}/{m.max}
                      </span>
                    ))}
                  </div>}
              </div>
              <div className="col-span-2 text-right">
                <button onClick={() => setRemarkForm({ student_id: student.student_id, content: '' })}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-stone-100"
                  style={{ color: T.accent }}>+ Remark</button>
              </div>
            </div>
          ))}
          {!loading && !data.length && <Empty icon={<BarChart2 size={18} />} text="No data available" />}
        </div>

        {remarkForm && (
          <Modal onClose={() => setRemarkForm(null)}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>Add Remark</h3>
            <Textarea rows={4} value={remarkForm.content}
              onChange={e => setRemarkForm(p => p ? { ...p, content: e.target.value } : null)}
              placeholder="Enter your remark…" />
            <div className="flex justify-end gap-2 mt-4">
              <Btn variant="ghost" onClick={() => setRemarkForm(null)}>Cancel</Btn>
              <Btn onClick={() => addRemark(remarkForm.student_id, remarkForm.content)}>Save</Btn>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
