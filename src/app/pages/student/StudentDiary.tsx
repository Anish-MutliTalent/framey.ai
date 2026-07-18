import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Book, CheckCircle2, Circle,
  MessageSquare, Calendar as CalIcon, Paperclip, Download,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday,
} from 'date-fns';
import { Layout } from '../../components/erp/Layout';
import { RenderText } from '../../components/erp/RenderText';
import { useApi } from '../../hooks/useApi';
import { API_BASE } from '../../contexts/AuthContext';
import { T } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiaryEntry {
  id: number; title: string; description?: string;
  due_date?: string; subject?: { name: string; color: string };
  is_completed: boolean; created_at: string;
  post_id?: number | null;
}
interface SubjectEntry {
  homework_entry_id: number; diary_entry_id: number | null;
  is_completed: boolean; subject_name: string; subject_color: string;
  date: string;
  classwork_title?: string; classwork_description?: string;
  homework_title?: string; homework_description?: string; homework_due_date?: string;
  post_id?: number | null;
  files: { id: number; original_name: string; file_type: string; size_bytes: number }[];
}
interface DiaryNote {
  id: number; author: string; author_role: string; content: string; date: string;
}

type MainTab  = 'calendar' | 'homework' | 'diary';
type HwFilter = 'incomplete' | 'complete';

// ── Sub-components — OUTSIDE parent so refs stay stable ───────────────────────

function SubjectCard({
  entry, token, onToggle,
}: {
  entry: SubjectEntry;
  token: string | null;
  onToggle: (diaryEntryId: number, current: boolean) => void;
}) {
  const navigate = useNavigate();
  const hasClasswork = !!(entry.classwork_title || entry.classwork_description);
  const hasHomework  = !!(entry.homework_title  || entry.homework_description);
  const color = entry.subject_color;
  const isAssignment = !!entry.post_id;

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${color}50`,
    cursor: isAssignment ? 'pointer' : 'default',
  };

  const content = (
    <>
      {/* Subject chip */}
      <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        style={{ background: color, color: '#fff' }}>
        {entry.subject_name}
        {isAssignment && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>Assignment</span>}
      </div>

      <div style={{ background: T.card }}>
        {/* Classwork section */}
        {hasClasswork && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color }}>Classwork</span>
            </div>
            {entry.classwork_title && (
              <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>
                {entry.classwork_title}
              </p>
            )}
            {entry.classwork_description && (
              <RenderText text={entry.classwork_description} tag="p"
                className="text-sm leading-relaxed" style={{ color: T.textSub }} />
            )}
          </div>
        )}

        {/* Divider between sections */}
        {hasClasswork && hasHomework && (
          <div style={{ borderTop: `1px solid ${T.border}` }} />
        )}

        {/* Homework section */}
        {hasHomework && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold" style={{ color }}>Homework</span>
              {/* Completion toggle — only for real diary entries, not assignments */}
              {entry.diary_entry_id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(entry.diary_entry_id!, entry.is_completed); }}
                  className="ml-auto flex items-center gap-1.5 text-xs transition-colors hover:opacity-70"
                  style={{ color: entry.is_completed ? T.success : T.textMuted }}>
                  {entry.is_completed
                    ? <><CheckCircle2 size={14} /> Done</>
                    : <><Circle size={14} /> Mark done</>}
                </button>
              )}
              {isAssignment && entry.is_completed && (
                <span className="ml-auto text-xs font-medium" style={{ color: T.success }}>Turned in</span>
              )}
            </div>
            {entry.homework_title && (
              <p className="text-sm font-semibold mb-1" style={{ color: T.text }}>
                {entry.homework_title}
              </p>
            )}
            {entry.homework_description && (
              <RenderText text={entry.homework_description} tag="p"
                className="text-sm leading-relaxed" style={{ color: T.textSub }} />
            )}
            {entry.homework_due_date && (
              <p className="text-xs mt-2 font-medium" style={{ color: T.warning }}>
                Due {format(new Date(entry.homework_due_date), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        )}

        {/* Attached files */}
        {entry.files.length > 0 && (
          <div className="px-5 pb-4 flex flex-wrap gap-2"
            style={{ borderTop: `1px solid ${T.border}` }}>
            <span className="w-full text-xs font-medium pt-3" style={{ color: T.textMuted }}>
              <Paperclip size={11} className="inline mr-1" />Attachments
            </span>
            {entry.files.map(f => (
              <a key={f.id}
                href={`${API_BASE}/homework/files/${f.id}/raw`}
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                style={{ background: T.bgDeep, border: `1px solid ${T.border}`, color: T.textSub }}>
                <Download size={11} />
                {f.original_name}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (isAssignment) {
    return (
      <button onClick={() => navigate(`/student/classroom/post/${entry.post_id}`)}
        className="w-full text-left rounded-2xl overflow-hidden transition-all hover:opacity-90 hover:-translate-y-0.5"
        style={cardStyle}>
        {content}
      </button>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      {content}
    </div>
  );
}

function HomeworkCard({ entry, onToggle }: { entry: DiaryEntry; onToggle: (e: DiaryEntry) => void }) {
  const navigate = useNavigate();
  const isAssignment = !!entry.post_id;

  const inner = (
    <div className="flex items-start gap-4">
      {isAssignment ? (
        <div className="mt-0.5 shrink-0" style={{ color: entry.is_completed ? T.success : T.textMuted }}>
          {entry.is_completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </div>
      ) : (
        <button onClick={() => onToggle(entry)} className="mt-0.5 shrink-0"
          style={{ color: entry.is_completed ? T.success : T.textMuted }}>
          {entry.is_completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={`text-sm font-bold ${entry.is_completed ? 'line-through' : ''}`}
            style={{ color: entry.is_completed ? T.textMuted : T.text }}>
            {entry.title}
          </h4>
          {isAssignment && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: T.warningBg, color: T.warning }}>Assignment</span>
          )}
          {isAssignment && (
            <span className="text-xs font-medium"
              style={{ color: entry.is_completed ? T.success : T.textMuted }}>
              {entry.is_completed ? 'Turned in' : 'Not submitted'}
            </span>
          )}
        </div>
        {entry.subject && (
          <p className="text-xs font-medium mt-0.5" style={{ color: entry.subject.color }}>
            {entry.subject.name}
          </p>
        )}
        {entry.description && (
          <RenderText text={entry.description} tag="p"
            className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }} />
        )}
        {entry.due_date && (
          <p className="text-xs mt-1.5" style={{ color: T.textMuted }}>
            Due {format(new Date(entry.due_date), 'MMM d, yyyy')}
          </p>
        )}
      </div>
    </div>
  );

  if (isAssignment) {
    return (
      <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate(`/student/classroom/post/${entry.post_id}`)}
        className="w-full text-left p-5 rounded-2xl border-l-4 transition-all hover:opacity-90 hover:-translate-y-0.5"
        style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderLeftColor: entry.is_completed ? T.success : (entry.subject?.color ?? T.accent),
          borderLeftWidth: 4, opacity: entry.is_completed ? 0.72 : 1, cursor: 'pointer',
        }}>
        {inner}
      </motion.button>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border-l-4"
      style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderLeftColor: entry.is_completed ? T.success : (entry.subject?.color ?? T.accent),
        borderLeftWidth: 4, opacity: entry.is_completed ? 0.72 : 1,
      }}>
      {inner}
    </motion.div>
  );
}

function CommunicationCard({ note }: { note: DiaryNote }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl relative overflow-hidden"
      style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: T.warning }} />
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: T.warningBg, color: T.warning }}>{note.author[0]}</div>
        <div>
          <p className="text-xs font-bold" style={{ color: T.text }}>{note.author}</p>
          <p className="text-xs capitalize" style={{ color: T.textMuted }}>{note.author_role}</p>
        </div>
        <span className="ml-auto text-xs" style={{ color: T.textMuted }}>
          {format(new Date(note.date), 'MMM d')}
        </span>
      </div>
      <RenderText text={note.content} tag="p"
        className="text-sm leading-relaxed" style={{ color: T.textSub, fontStyle: 'italic' }} />
    </motion.div>
  );
}

// ── Calendar sidebar ───────────────────────────────────────────────────────────
function CalendarPicker({
  currentMonth, setCurrentMonth, selectedDate, setSelectedDate, hasActivity,
}: {
  currentMonth: Date; setCurrentMonth: (d: Date) => void;
  selectedDate: Date; setSelectedDate: (d: Date) => void;
  hasActivity: (d: Date) => boolean;
}) {
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = startOfMonth(currentMonth).getDay();

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: T.text }}>
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-100" style={{ color: T.textMuted }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-xs font-semibold py-1 uppercase tracking-wide"
            style={{ color: T.textMuted }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const hasDot = hasActivity(day);
          return (
            <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
              className="aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all"
              style={isSelected
                ? { background: T.accent, color: '#fff' }
                : isTodayDay ? { color: T.accent, fontWeight: 700 } : { color: T.textSub }}>
              {format(day, 'd')}
              {hasDot && !isSelected && (
                <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: T.accent }} />
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>Legend</p>
        {[
          { color: T.accent, label: 'Has Activity' },
          { color: T.success, label: 'Completed' },
          { color: T.warning, label: 'Teacher Note' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2.5 text-xs" style={{ color: T.textSub }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function StudentDiary() {
  const { request } = useApi();
  const token = localStorage.getItem('academia_token');

  const [entries, setEntries]           = useState<DiaryEntry[]>([]);
  const [notes, setNotes]               = useState<DiaryNote[]>([]);
  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>([]);
  const [activeDates, setActiveDates]   = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [calLoading, setCalLoading]     = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mainTab, setMainTab]           = useState<MainTab>('calendar');
  const [hwFilter, setHwFilter]         = useState<HwFilter>('incomplete');

  // Load flat diary entries + diary notes + dates-with-entries
  useEffect(() => {
    setLoading(true);
    Promise.all([
      request<DiaryEntry[]>('/students/diary'),
      request<DiaryNote[]>('/students/diary-notes'),
      request<string[]>('/students/diary/dates-with-entries'),
    ]).then(([e, n, d]) => { setEntries(e); setNotes(n); setActiveDates(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [request]);

  // Load subject-grouped entries for the calendar view whenever date changes
  useEffect(() => {
    if (mainTab !== 'calendar') return;
    setCalLoading(true);
    request<SubjectEntry[]>(`/students/diary/by-date?date_str=${format(selectedDate, 'yyyy-MM-dd')}`)
      .then(setSubjectEntries)
      .catch(console.error)
      .finally(() => setCalLoading(false));
  }, [selectedDate, mainTab, request]);

  // Toggle completion (on flat DiaryEntry)
  const toggleFlat = async (entry: DiaryEntry) => {
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_completed: !e.is_completed } : e));
    try {
      await request(`/students/diary/${entry.id}`, { method: 'PATCH', body: { is_completed: !entry.is_completed } });
    } catch {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_completed: entry.is_completed } : e));
    }
  };

  // Toggle completion (from calendar subject card)
  const toggleSubject = async (diaryEntryId: number, current: boolean) => {
    setSubjectEntries(prev => prev.map(e =>
      e.diary_entry_id === diaryEntryId ? { ...e, is_completed: !current } : e
    ));
    // Also update flat list
    setEntries(prev => prev.map(e => e.id === diaryEntryId ? { ...e, is_completed: !current } : e));
    try {
      await request(`/students/diary/${diaryEntryId}`, { method: 'PATCH', body: { is_completed: !current } });
    } catch {
      setSubjectEntries(prev => prev.map(e =>
        e.diary_entry_id === diaryEntryId ? { ...e, is_completed: current } : e
      ));
    }
  };

  // Helpers
  const notesOnDay  = (d: Date) => notes.filter(n => isSameDay(new Date(n.date), d));
  const hasActivity = (d: Date) => {
    const ds = format(d, 'yyyy-MM-dd');
    return activeDates.includes(ds) || notesOnDay(d).length > 0;
  };

  const filteredHw = (() => {
    if (hwFilter === 'incomplete') return entries.filter(e => !e.is_completed);
    if (hwFilter === 'complete')   return entries.filter(e => e.is_completed);
    return [];
  })();

  const calNotes = notesOnDay(selectedDate);

  const hwDateLabel = hwFilter === 'incomplete' ? 'Incomplete homework' : 'Completed homework';

  return (
    <Layout title="Class Diary">
      {/* Main tab strip */}
      <div className="flex gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        {([
          { id: 'calendar', label: 'Calendar View',     icon: CalIcon },
          { id: 'homework', label: 'Homework List',     icon: Book },
          { id: 'diary',    label: 'Communication Log', icon: MessageSquare },
        ] as { id: MainTab; label: string; icon: React.ElementType }[]).map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={mainTab === t.id
              ? { background: T.accent, color: '#fff' }
              : { background: T.bgDeep, color: T.textSub, border: `1px solid ${T.border}` }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CALENDAR + HOMEWORK tabs share the two-column layout ── */}
      {(mainTab === 'calendar' || mainTab === 'homework') && (
        <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* Calendar picker */}
          <CalendarPicker
            currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            hasActivity={hasActivity}
          />

          {/* Right content */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* ── CALENDAR VIEW ── */}
            {mainTab === 'calendar' && (
              <>
                <div className="flex items-center gap-3 sticky top-0 py-1" style={{ background: T.bg }}>
                  <h2 className="text-sm font-semibold" style={{ color: T.text }}>
                    {format(selectedDate, 'EEEE, MMMM do')}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full"
                    style={{ background: T.bgDeep, color: T.textMuted, border: `1px solid ${T.border}` }}>
                    {subjectEntries.length + calNotes.length} item{subjectEntries.length + calNotes.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {calLoading && <Skeleton />}

                {!calLoading && subjectEntries.length === 0 && calNotes.length === 0 && (
                  <Empty icon={<CalIcon size={28} />} text="No entries for this date." />
                )}

                {/* Subject-grouped classwork/homework cards */}
                {subjectEntries.map(entry => (
                  <SubjectCard
                    key={entry.homework_entry_id}
                    entry={entry}
                    token={token}
                    onToggle={toggleSubject}
                  />
                ))}

                {/* Diary notes for this day */}
                {calNotes.length > 0 && (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                      style={{ color: T.textMuted }}>Communication Log</p>
                    <div className="space-y-3">
                      {calNotes.map(n => <CommunicationCard key={n.id} note={n} />)}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── HOMEWORK LIST ── */}
            {mainTab === 'homework' && (
              <>
                <div className="flex items-center gap-2 flex-wrap sticky top-0 py-1" style={{ background: T.bg }}>
                  {(['incomplete', 'complete'] as HwFilter[]).map(f => (
                    <button key={f} onClick={() => setHwFilter(f)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all"
                      style={hwFilter === f
                        ? { background: T.accent, color: '#fff' }
                        : { background: T.bgDeep, color: T.textMuted, border: `1px solid ${T.border}` }}>
                      {f}
                    </button>
                  ))}
                  <span className="text-xs ml-auto" style={{ color: T.textMuted }}>{hwDateLabel}</span>
                </div>

                {loading && <Skeleton />}

                {!loading && filteredHw.length === 0 && (
                  <Empty icon={<Book size={28} />}
                    text={hwFilter === 'incomplete' ? 'All caught up! No pending homework or assignments.' : 'Nothing completed yet.'}
                  />
                )}

                <div className="space-y-3">
                  {filteredHw.map(e => <HomeworkCard key={e.id} entry={e} onToggle={toggleFlat} />)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── COMMUNICATION LOG ── */}
      {mainTab === 'diary' && (
        <div className="max-w-2xl space-y-4">
          <p className="text-xs" style={{ color: T.textMuted }}>
            Notes from your teacher or school — shared with your parents.
          </p>
          {loading && <Skeleton />}
          {!loading && notes.length === 0 && (
            <Empty icon={<MessageSquare size={28} />} text="No communication notes yet." />
          )}
          <div className="space-y-4">
            {notes.map(n => <CommunicationCard key={n.id} note={n} />)}
          </div>
        </div>
      )}
    </Layout>
  );
}

function Skeleton() {
  return <div className="space-y-3 animate-pulse">
    {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl" style={{ background: T.bgDeep }} />)}
  </div>;
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center py-16 gap-3" style={{ color: T.textMuted }}>
    {icon}<span className="text-sm">{text}</span>
  </div>;
}
