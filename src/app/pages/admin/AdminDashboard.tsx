import { useEffect, useState } from 'react';
import { Layout } from '../../components/erp/Layout';
import { Card } from '../../components/erp/UI';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Users, BookOpen, GraduationCap, Settings } from 'lucide-react';

interface School { id: number; name: string; grading_system: string; }

export function AdminDashboard() {
  const { request } = useApi();
  const [school, setSchool] = useState<School | null>(null);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    Promise.all([
      request<School>('/admin/school'),
      request<unknown[]>('/admin/users').then(u => u.length).catch(() => 0),
    ]).then(([s, count]) => { setSchool(s); setUserCount(count); }).catch(console.error);
  }, [request]);

  const links = [
    { label: 'Manage Users',         icon: <Users size={18} />,         href: '/admin/users',    desc: 'Accounts & roles' },
    { label: 'Classes & Sections',   icon: <GraduationCap size={18} />, href: '/admin/classes',  desc: 'Structure' },
    { label: 'Subjects',             icon: <BookOpen size={18} />,      href: '/admin/subjects', desc: 'Curriculum' },
    { label: 'School Configuration', icon: <Settings size={18} />,      href: '/admin/config',   desc: 'Grading, terms, year' },
  ];

  return (
    <Layout title="Admin Dashboard">
      <div className="max-w-4xl space-y-5">
        {school && (
          <div className="rounded-2xl p-6" style={{ background: T.bgDeep, border: `1px solid ${T.border}` }}>
            <h2 className="text-lg font-semibold" style={{ color: T.text }}>{school.name}</h2>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Grading: <span className="capitalize font-medium" style={{ color: T.textSub }}>{school.grading_system}</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <div className="text-3xl font-bold" style={{ color: T.text }}>{userCount}</div>
            <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>Total Users</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map(l => (
            <a key={l.label} href={l.href}
              className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:bg-stone-100"
              style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: T.bgDeep, color: T.accent }}>{l.icon}</div>
              <div>
                <div className="text-xs font-semibold" style={{ color: T.text }}>{l.label}</div>
                <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>{l.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}
