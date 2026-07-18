import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';

interface TimetableEntry {
  id: number;
  subject: { name: string; color: string };
  teacher: { name: string };
  room?: { name: string };
  time_slot: {
    period_number: number;
    start_time: string;
    end_time: string;
    day_of_week: number;
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function StudentTimetable() {
  const { request } = useApi();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Default to today's weekday (0=Mon … 4=Fri, clamp to available days)
  const todayDow = new Date().getDay(); // 0=Sun
  const defaultDay = todayDow === 0 ? 0 : Math.min(todayDow - 1, 4); // Mon-Fri, default Mon for Sun
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  useEffect(() => {
    request<{ section: { id: number } }>('/students/me')
      .then(s => setSectionId(s.section.id))
      .catch(console.error);
  }, [request]);

  useEffect(() => {
    if (!sectionId) return;
    request<TimetableEntry[]>(`/timetable/section/${sectionId}`)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sectionId, request]);

  // Days that actually have entries
  const activeDays = [...new Set(entries.map(e => e.time_slot.day_of_week))].sort();

  // Entries for selected day, sorted by start time
  const dayEntries = entries
    .filter(e => e.time_slot.day_of_week === selectedDay)
    .sort((a, b) => a.time_slot.start_time.localeCompare(b.time_slot.start_time));

  return (
    <Layout title="Timetable">
      <div className="max-w-xl space-y-5">
        {/* Day selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DAYS.map((day, i) => {
            const hasClasses = activeDays.includes(i);
            const isToday = new Date().getDay() - 1 === i;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={selectedDay === i
                  ? { background: T.accent, color: '#fff' }
                  : isToday
                    ? { background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}40` }
                    : { background: T.bgDeep, color: hasClasses ? T.textSub : T.textMuted, border: `1px solid ${T.border}`, opacity: hasClasses ? 1 : 0.5 }
                }
              >
                {SHORT_DAYS[i]}
              </button>
            );
          })}
        </div>

        {/* Day label */}
        <div>
          <h2 className="text-base font-semibold" style={{ color: T.text }}>{DAYS[selectedDay]}</h2>
          <p className="text-xs" style={{ color: T.textMuted }}>
            {dayEntries.length} period{dayEntries.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 rounded-2xl" style={{ background: T.bgDeep }} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && dayEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2" style={{ color: T.textMuted }}>
            <p className="text-sm">No classes on {DAYS[selectedDay]}</p>
          </div>
        )}

        {/* Timeline */}
        {!loading && dayEntries.length > 0 && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[52px] top-0 bottom-0 w-px" style={{ background: T.border }} />

            <div className="space-y-0">
              {dayEntries.map((entry, idx) => {
                const start = fmt12(entry.time_slot.start_time);
                const end = fmt12(entry.time_slot.end_time);

                return (
                  <div key={entry.id} className="flex items-start gap-4">
                    {/* Time column */}
                    <div className="w-[52px] shrink-0 flex flex-col items-end pt-5">
                      <span className="text-xs font-medium leading-none" style={{ color: T.textMuted }}>
                        {start.split(' ')[0]}
                      </span>
                      <span className="text-xs leading-none" style={{ color: T.textMuted }}>
                        {start.split(' ')[1]}
                      </span>
                    </div>

                    {/* Dot */}
                    <div className="relative shrink-0 flex items-start pt-[22px]">
                      <div className="w-3 h-3 rounded-full border-2 z-10"
                        style={{
                          background: T.card,
                          borderColor: entry.subject.color,
                        }} />
                    </div>

                    {/* Card */}
                    <div className="flex-1 pb-4 pt-3">
                      <div className="p-4 rounded-2xl transition-all"
                        style={{ background: T.card, border: `1px solid ${T.border}` }}>

                        {/* Period badge + time range */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: `${entry.subject.color}18`, color: entry.subject.color }}>
                            Period {entry.time_slot.period_number}
                          </span>
                          <span className="text-xs" style={{ color: T.textMuted }}>
                            {start} – {end}
                          </span>
                        </div>

                        {/* Subject name — bold, large */}
                        <h3 className="text-base font-bold uppercase tracking-wide"
                          style={{ color: T.text }}>
                          {entry.subject.name}
                        </h3>

                        {/* Teacher */}
                        <p className="text-xs mt-1" style={{ color: T.textMuted }}>{entry.teacher.name}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* End time marker */}
              {dayEntries.length > 0 && (
                <div className="flex items-start gap-4">
                  <div className="w-[52px] shrink-0 flex flex-col items-end pt-1">
                    <span className="text-xs font-medium leading-none" style={{ color: T.textMuted }}>
                      {fmt12(dayEntries[dayEntries.length - 1].time_slot.end_time).split(' ')[0]}
                    </span>
                    <span className="text-xs leading-none" style={{ color: T.textMuted }}>
                      {fmt12(dayEntries[dayEntries.length - 1].time_slot.end_time).split(' ')[1]}
                    </span>
                  </div>
                  <div className="relative shrink-0 flex items-start pt-[5px]">
                    <div className="w-3 h-3 rounded-full border-2 z-10"
                      style={{ background: T.card, borderColor: T.border }} />
                  </div>
                  <div className="flex-1 pt-1">
                    <span className="text-xs font-medium" style={{ color: T.textMuted }}>End of day</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
