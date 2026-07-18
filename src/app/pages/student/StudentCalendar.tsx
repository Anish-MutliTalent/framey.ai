import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Empty, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';

interface Event {
  id: number; title: string; description?: string;
  event_type: string;
  start_date: string;     // ISO datetime
  end_date?: string;      // ISO datetime, optional
  scope: string;
}

const EVENT_COLORS: Record<string, string> = {
  holiday:        T.danger,
  exam:           T.warning,
  school_event:   T.info,
  pd_day:         '#7C3AED',
  staff_meeting:  T.textMuted,
};
const EVENT_LABEL: Record<string, string> = {
  holiday: 'Holiday', exam: 'Exam', school_event: 'School',
  pd_day: 'PD Day', staff_meeting: 'Meeting',
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSpans(dateStr: string, endStr: string | undefined, year: number, month: number, targetDay: number): boolean {
  const s = new Date(dateStr);
  const e = endStr ? new Date(endStr) : s;
  const t = new Date(year, month, targetDay);
  // set hours so range checks are inclusive
  s.setHours(0,0,0,0); e.setHours(23,59,59,999); t.setHours(12,0,0,0);
  return t >= s && t <= e;
}

// ── Main component (used by both student & teacher) ──────────────────────────

export function StudentCalendar() {
  const { request } = useApi();
  const [events, setEvents]     = useState<Event[]>([]);
  const [loading, setLoading]   = useState(true);
  const [current, setCurrent]   = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  useEffect(() => {
    request<Event[]>('/calendar/events')
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [request]);

  // When month changes, reset selected day
  useEffect(() => { setSelectedDay(new Date().getDate()); }, [current.getMonth(), current.getFullYear()]);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  // Events active on a given day (handles multi-day spans)
  const eventsOnDay = (d: number) =>
    events.filter(e => daysSpans(e.start_date, e.end_date, year, month, d));

  const selectedDateEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  // Upcoming events across all dates
  const upcoming = events
    .filter(e => new Date(e.end_date ?? e.start_date) >= today)
    .sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date))
    .slice(0, 8);

  return (
    <Layout title="Calendar">
      <div className="max-w-5xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Calendar grid ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 rounded-2xl p-5"
            style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: T.text }}>{MONTHS[month]} {year}</h2>
              <div className="flex gap-1">
                <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors" style={{ color: T.textMuted }}>
                  <ChevronLeft size={15} />
                </button>
                <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors" style={{ color: T.textMuted }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: T.textMuted }}>{d}</div>
              ))}
            </div>

            {loading && <Skeleton rows={4} />}

            {!loading && (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const dayEvents = eventsOnDay(d);
                  const isSelected = selectedDay === d;
                  const todayFlag = isToday(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className="aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all"
                      style={{
                        background: isSelected ? T.accent
                                   : todayFlag ? T.accentBg
                                   : T.bg,
                        border: `1px solid ${
                          isSelected ? T.accent
                              : todayFlag ? T.accent + '40'
                              : T.border
                        }`,
                      }}>
                      <span className="text-xs font-semibold"
                        style={{ color: isSelected ? '#fff' : todayFlag ? T.accent : T.textSub }}>{d}</span>
                      {/* Color indicator(s) */}
                      {dayEvents.length > 0 && (
                        <>
                          {dayEvents.length === 1 && (
                            <div className="w-2 h-2 rounded-full mt-0.5"
                              style={{ background: isSelected ? '#fff' : EVENT_COLORS[dayEvents[0].event_type] ?? T.accent }} />
                          )}
                          {dayEvents.length >= 2 && (
                            <div className="absolute bottom-1 right-1 min-w-4 h-4 rounded-full px-1.5 flex items-center justify-center text-[10px] font-bold"
                              style={{
                                background: isSelected ? '#fff' : EVENT_COLORS[dayEvents[0].event_type] ?? T.accent,
                                color: isSelected ? T.accent : '#fff',
                              }}>
                              {dayEvents.length}
                            </div>
                          )}
                          {dayEvents.length >= 2 && (
                            <div className="absolute bottom-1 left-1 flex gap-0.5">
                              {dayEvents.slice(1, 3).map(e => (
                                <div key={e.id} className="w-1 h-1 rounded-full"
                                  style={{ background: isSelected ? 'rgba(255,255,255,0.6)' : EVENT_COLORS[e.event_type] ?? T.accent }} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-3"
              style={{ borderTop: `1px solid ${T.border}` }}>
              {Object.entries(EVENT_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs" style={{ color: T.textMuted }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {EVENT_LABEL[type] ?? type}
                </div>
              ))}
            </div>
          </div>

          {/* ── Side panel: selected day's events ────────────────────── */}
          <div className="space-y-5">
            {/* Today's date with selected-day count */}
            <div className="rounded-2xl p-5"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>
                    {selectedDay ? `${MONTHS[month].slice(0, 3)} ${selectedDay}` : 'No day selected'}
                  </p>
                  <h3 className="text-base font-bold mt-0.5" style={{ color: T.text }}>
                    {selectedDateEvents.length === 0
                      ? 'Nothing scheduled'
                      : `${selectedDateEvents.length} event${selectedDateEvents.length > 1 ? 's' : ''}`}
                  </h3>
                </div>
                <CalIcon size={20} style={{ color: T.textMuted }} />
              </div>

              <div className="space-y-3">
                {selectedDateEvents.length === 0 && (
                  <p className="text-xs py-4 text-center" style={{ color: T.textMuted }}>
                    Click a highlighted day above to view its events.
                  </p>
                )}
                {selectedDateEvents.map(e => (
                  <div key={e.id}
                    className="rounded-xl p-3 border-l-2"
                    style={{
                      background: T.bgDeep,
                      borderLeftColor: EVENT_COLORS[e.event_type] ?? T.accent,
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full"
                        style={{ background: EVENT_COLORS[e.event_type] ?? T.accent }} />
                      <span className="text-sm font-semibold" style={{ color: T.text }}>{e.title}</span>
                    </div>
                    {e.description && (
                      <p className="text-xs mt-1.5" style={{ color: T.textSub }}>{e.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: T.bg, color: T.textMuted, border: `1px solid ${T.border}` }}>
                        {EVENT_LABEL[e.event_type] ?? e.event_type}
                      </span>
                      {e.scope === 'teacher_only' && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#7C3AED18', color: '#7C3AED' }}>
                          Staff only
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming list */}
            <div className="rounded-2xl p-5"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
                Upcoming
              </p>
              {upcoming.length === 0 && (
                <p className="text-xs py-2 text-center" style={{ color: T.textMuted }}>Nothing upcoming.</p>
              )}
              <div className="space-y-2">
                {upcoming.map(e => (
                  <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-xl"
                    style={{ background: T.bg }}>
                    <div className="w-1.5 h-1.5 mt-2 rounded-full shrink-0"
                      style={{ background: EVENT_COLORS[e.event_type] ?? T.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{e.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                        {new Date(e.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
