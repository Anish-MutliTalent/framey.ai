import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { T } from '../../theme';

interface TimetableEntry {
  id: number;
  subject: { name: string; color: string };
  teacher?: { name: string };
  time_slot: { period_number: number; start_time: string; end_time: string; day_of_week: number };
  section_id: number;
  section_name?: string; // present in teacher's own timetable response
}

interface ClassSection {
  section_id: number;
  section_name: string;
  class_name: string;
  section_letter: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${(h % 12 || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function TimetableView({ entries, loading, mode = 'section' }: {
  entries: TimetableEntry[];
  loading: boolean;
  /** 'teacher' = show class name bold + subject grey; 'section' = show subject bold */
  mode?: 'teacher' | 'section';
}) {
  const todayDow = new Date().getDay();
  const defaultDay = todayDow === 0 ? 0 : Math.min(todayDow - 1, 4);
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  const activeDays = [...new Set(entries.map(e => e.time_slot.day_of_week))].sort();
  const dayEntries = entries
    .filter(e => e.time_slot.day_of_week === selectedDay)
    .sort((a, b) => a.time_slot.start_time.localeCompare(b.time_slot.start_time));

  return (
    <div className="space-y-5">
      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((day, i) => {
          const has = activeDays.includes(i);
          const isToday = new Date().getDay() - 1 === i;
          return (
            <button key={day} onClick={() => setSelectedDay(i)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={selectedDay === i
                ? { background: T.accent, color: '#fff' }
                : isToday
                  ? { background: T.accentBg, color: T.accent, border: `1px solid ${T.accent}40` }
                  : { background: T.bgDeep, color: has ? T.textSub : T.textMuted, border: `1px solid ${T.border}`, opacity: has ? 1 : 0.5 }
              }>
              {SHORT_DAYS[i]}
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-base font-semibold" style={{ color: T.text }}>{DAYS[selectedDay]}</h2>
        <p className="text-xs" style={{ color: T.textMuted }}>
          {dayEntries.length} class{dayEntries.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl" style={{ background: T.bgDeep }} />)}
        </div>
      )}

      {!loading && !dayEntries.length && (
        <div className="text-center py-20 text-sm" style={{ color: T.textMuted }}>
          No classes on {DAYS[selectedDay]}
        </div>
      )}

      {!loading && dayEntries.length > 0 && (
        <div className="relative">
          <div className="absolute left-[52px] top-0 bottom-0 w-px" style={{ background: T.border }} />
          <div className="space-y-0">
            {dayEntries.map(entry => {
              const start = fmt12(entry.time_slot.start_time);
              const end = fmt12(entry.time_slot.end_time);
              return (
                <div key={entry.id} className="flex items-start gap-4">
                  <div className="w-[52px] shrink-0 flex flex-col items-end pt-5">
                    <span className="text-xs font-medium leading-none" style={{ color: T.textMuted }}>{start.split(' ')[0]}</span>
                    <span className="text-xs leading-none" style={{ color: T.textMuted }}>{start.split(' ')[1]}</span>
                  </div>
                  <div className="relative shrink-0 flex items-start pt-[22px]">
                    <div className="w-3 h-3 rounded-full border-2 z-10"
                      style={{ background: T.card, borderColor: entry.subject.color }} />
                  </div>
                  <div className="flex-1 pb-4 pt-3">
                    <div className="p-4 rounded-2xl" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          style={{ background: `${entry.subject.color}18`, color: entry.subject.color }}>
                          Period {entry.time_slot.period_number}
                        </span>
                        <span className="text-xs" style={{ color: T.textMuted }}>{start} – {end}</span>
                      </div>
                      {mode === 'teacher' ? (
                        <>
                          {/* Primary: class name */}
                          <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: T.text }}>
                            {entry.section_name ?? `Section ${entry.section_id}`}
                          </h3>
                          {/* Secondary: subject */}
                          <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>{entry.subject.name}</p>
                        </>
                      ) : (
                        /* Section timetable: subject is what matters */
                        <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: T.text }}>
                          {entry.subject.name}
                        </h3>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* End marker */}
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
                <div className="w-3 h-3 rounded-full border-2 z-10" style={{ background: T.card, borderColor: T.border }} />
              </div>
              <div className="flex-1 pt-1">
                <span className="text-xs font-medium" style={{ color: T.textMuted }}>End of day</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherTimetable() {
  const { request } = useApi();
  const { hasRole } = useAuth();

  const [myEntries, setMyEntries]       = useState<TimetableEntry[]>([]);
  const [classEntries, setClassEntries] = useState<TimetableEntry[]>([]);
  const [classSection, setClassSection] = useState<ClassSection | null | undefined>(undefined); // undefined = still loading
  const [tab, setTab]                   = useState<'mine' | 'class'>('mine');
  const [loadingMine, setLoadingMine]   = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);

  // Show second tab for class teachers and coordinators/principals
  const canHaveClassSection = hasRole('class_teacher', 'coordinator', 'principal', 'tech_admin');

  useEffect(() => {
    // Always fetch own timetable
    request<TimetableEntry[]>('/timetable/teacher/me')
      .then(setMyEntries).catch(console.error).finally(() => setLoadingMine(false));

    // Always try to get a class section — any teacher could be a class teacher
    setLoadingClass(true);
    request<ClassSection | null>('/teachers/my-class-section')
      .then(sec => {
        setClassSection(sec);          // null = no class assigned, object = has one
        if (sec) {
          return request<TimetableEntry[]>(`/timetable/section/${sec.section_id}`)
            .then(setClassEntries);
        }
      })
      .catch(() => setClassSection(null))
      .finally(() => setLoadingClass(false));
  }, [request]);

  // Only show tabs once we know whether a section exists (classSection !== undefined)
  const showTabs = classSection !== undefined && classSection !== null;

  return (
    <Layout title="Timetable">
      <div className="max-w-xl">
        {/* Tab switcher — only visible once we've confirmed a class section exists */}
        {showTabs && (
          <div className="flex gap-1 p-1 rounded-xl w-fit mb-6"
            style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
            <button onClick={() => setTab('mine')}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === 'mine'
                ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: T.textMuted }}>
              My Classes
            </button>
            <button onClick={() => setTab('class')}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === 'class'
                ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: T.textMuted }}>
              {classSection.section_name}
            </button>
          </div>
        )}

        {tab === 'mine' && (
          <TimetableView entries={myEntries} loading={loadingMine} mode="teacher" />
        )}

        {tab === 'class' && classSection && (
          <TimetableView entries={classEntries} loading={loadingClass} mode="section" />
        )}
      </div>
    </Layout>
  );
}
