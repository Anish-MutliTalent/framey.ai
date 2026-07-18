import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Card, Skeleton } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react';

interface AttendanceData {
  total: number;
  present_days: number;
  percentage: number;
  records: { date: string; status: string; remarks?: string }[];
}

const STATUS_CFG = {
  present:  { color: T.success, icon: <CheckCircle2 size={11} />, label: 'Present' },
  absent:   { color: T.danger,  icon: <XCircle size={11} />,      label: 'Absent'  },
  half_day: { color: T.warning, icon: <Clock size={11} />,         label: 'Half Day' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function StudentAttendance() {
  const { request } = useApi();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    request<AttendanceData>('/students/attendance')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [request]);

  if (loading) return <Layout title="Attendance"><Skeleton /></Layout>;

  const pct = data?.percentage ?? 0;
  const good = pct >= 75;

  // Records in the selected month
  const monthRecords = (data?.records ?? []).filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === viewMonth.year && d.getMonth() === viewMonth.month;
  });

  // Build calendar grid
  const firstDay = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const today = new Date();

  const byDate: Record<string, { status: string; remarks?: string }> = {};
  for (const r of monthRecords) byDate[r.date] = r;

  // Count per status for this month
  const monthCounts = { present: 0, absent: 0, half_day: 0 };
  for (const r of monthRecords) {
    if (r.status in monthCounts) monthCounts[r.status as keyof typeof monthCounts]++;
  }

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  );
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  );

  return (
    <Layout title="Attendance">
      <div className="max-w-2xl space-y-5">

        {/* Overall summary card */}
        <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textMuted }}>
                Overall Attendance
              </p>
              <div className="flex items-end gap-3 mt-1">
                <span className="text-4xl font-bold" style={{ color: good ? T.success : T.danger }}>
                  {pct}%
                </span>
                <span className="text-sm mb-1" style={{ color: T.textMuted }}>
                  {data?.present_days} / {data?.total} days
                </span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: good ? T.successBg : T.dangerBg }}>
              <TrendingUp size={22} style={{ color: good ? T.success : T.danger }} />
            </div>
          </div>

          <div className="h-2 rounded-full overflow-hidden" style={{ background: T.bgDeep }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%`, background: good ? T.success : T.danger }} />
          </div>

          {!good && (
            <p className="text-xs mt-3" style={{ color: T.danger }}>
              Below 75% — {Math.ceil((0.75 * (data?.total ?? 0) - (data?.present_days ?? 0)) / 0.25)} more days needed to reach 75%
            </p>
          )}
        </div>

        {/* Monthly calendar */}
        <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: T.textMuted }}>←</button>
            <span className="text-sm font-semibold" style={{ color: T.text }}>
              {MONTHS[viewMonth.month]} {viewMonth.year}
            </span>
            <button onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: T.textMuted }}>→</button>
          </div>

          {/* Month counts */}
          <div className="flex gap-3 mb-4">
            {(Object.entries(STATUS_CFG) as [string, typeof STATUS_CFG[keyof typeof STATUS_CFG]][]).map(([s, cfg]) => (
              <div key={s} className="flex items-center gap-1.5 text-xs" style={{ color: cfg.color }}>
                {cfg.icon}
                <span className="font-medium">{monthCounts[s as keyof typeof monthCounts]}</span>
                <span style={{ color: T.textMuted }}>{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="text-center text-xs font-semibold py-1" style={{ color: T.textMuted }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const rec = byDate[dateStr];
              const cfg = rec ? STATUS_CFG[rec.status as keyof typeof STATUS_CFG] : null;
              const isToday = today.getFullYear() === viewMonth.year &&
                today.getMonth() === viewMonth.month &&
                today.getDate() === day;

              return (
                <div key={day}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center relative group"
                  title={rec ? `${rec.status}${rec.remarks ? ` — ${rec.remarks}` : ''}` : undefined}
                  style={{
                    background: cfg ? `${cfg.color}12` : isToday ? T.accentBg : T.bg,
                    border: `1px solid ${cfg ? cfg.color + '35' : isToday ? T.accent : 'transparent'}`,
                  }}>
                  <span className="text-xs font-medium"
                    style={{ color: cfg ? cfg.color : isToday ? T.accent : T.textSub }}>
                    {day}
                  </span>
                  {cfg && (
                    <span className="mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
                  )}
                  {/* Tooltip for remarks */}
                  {rec?.remarks && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-xs whitespace-nowrap z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: T.text, color: '#fff' }}>
                      {rec.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: T.textSub }}>
                <span style={{ color: v.color }}>{v.icon}</span>
                {v.label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent records list */}
        {data && data.records.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              style={{ background: T.bgDeep, color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
              Recent Records
            </div>
            {[...data.records].reverse().slice(0, 10).map((r, idx) => {
              const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG];
              return (
                <div key={r.date} className="flex items-center gap-3 px-4 py-3"
                  style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
                  <span className="text-xs font-medium w-24 shrink-0" style={{ color: T.text }}>
                    {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: cfg?.color ?? T.textMuted }}>
                    {cfg?.icon} {cfg?.label ?? r.status}
                  </span>
                  {r.remarks && (
                    <span className="text-xs ml-auto" style={{ color: T.textMuted }}>
                      {r.remarks}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </Layout>
  );
}
