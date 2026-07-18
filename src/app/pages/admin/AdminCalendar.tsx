import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Btn, Input, Select, Label, Modal } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface Event {
  id: number; title: string; description?: string; event_type: string;
  start_date: string; end_date?: string; scope: string;
}
const EVENT_COLORS: Record<string,string> = {
  holiday: T.danger, exam: T.warning, school_event: T.info, pd_day: '#7C3AED', staff_meeting: T.textMuted,
};
const EVENT_TYPES = ['holiday','exam','school_event','pd_day','staff_meeting'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function AdminCalendar() {
  const { request } = useApi();
  const [events, setEvents]     = useState<Event[]>([]);
  const [current, setCurrent]   = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_type: 'school_event', start_date: '', end_date: '', scope: 'school_wide' });

  const load = () => request<Event[]>('/calendar/events').then(setEvents).catch(console.error);
  useEffect(() => { load(); }, [request]);

  const create = async () => {
    await request('/calendar/events', { method: 'POST', body: { ...form, end_date: form.end_date || null } });
    setShowForm(false); setForm({ title: '', description: '', event_type: 'school_event', start_date: '', end_date: '', scope: 'school_wide' });
    load();
  };
  const del = async (id: number) => { await request(`/calendar/events/${id}`, { method: 'DELETE' }); load(); };

  const year = current.getFullYear(), month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  const eventsOnDay = (d: number) => events.filter(e => { const dt = new Date(e.start_date); return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === d; });

  return (
    <Layout title="Calendar">
      <div className="max-w-5xl space-y-5">
        <div className="flex justify-end">
          <Btn onClick={() => setShowForm(true)}><Plus size={13} /> Add Event</Btn>
        </div>

        {showForm && (
          <Modal onClose={() => setShowForm(false)}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: T.textMuted }}>New Event</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Type</Label>
                  <Select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </Select>
                </div>
                <div><Label>Start Date</Label><Input type="datetime-local" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><Label>End Date</Label><Input type="datetime-local" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Scope</Label>
                <Select value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}>
                  <option value="school_wide">School-wide</option>
                  <option value="teacher_only">Staff only</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
                <Btn onClick={create}>Create</Btn>
              </div>
            </div>
          </Modal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar grid */}
          <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: T.text }}>{MONTHS[month]} {year}</h2>
              <div className="flex gap-1">
                <button onClick={() => setCurrent(new Date(year, month-1, 1))}
                  className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}><ChevronLeft size={15} /></button>
                <button onClick={() => setCurrent(new Date(year, month+1, 1))}
                  className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}><ChevronRight size={15} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: T.textMuted }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_,i) => {
                const d = i + 1;
                const de = eventsOnDay(d);
                return (
                  <div key={d} className="aspect-square rounded-xl flex flex-col items-center justify-start p-1"
                    style={{ background: isToday(d) ? T.accentBg : T.bg, border: `1px solid ${isToday(d) ? T.accent : 'transparent'}` }}>
                    <span className="text-xs font-medium" style={{ color: isToday(d) ? T.accent : T.textSub }}>{d}</span>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {de.slice(0,3).map(e => (
                        <div key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_COLORS[e.event_type] ?? T.accent }} title={e.title} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event list */}
          <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>All Events</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map(e => {
                const color = EVENT_COLORS[e.event_type] ?? T.accent;
                return (
                  <div key={e.id} className="flex items-start gap-2 p-3 rounded-xl group"
                    style={{ background: T.bg }}>
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: T.text }}>{e.title}</div>
                      <div className="text-xs capitalize mt-0.5" style={{ color }}>
                        {new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <button onClick={() => del(e.id)}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: T.danger }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
