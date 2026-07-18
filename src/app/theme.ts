// Single source of truth for ERP design tokens
export const T = {
  // Backgrounds
  bg:         '#F7F5F0',   // warm cream base
  bgDeep:     '#EEEAE3',   // sidebar / table header
  card:       '#FFFFFF',   // card surface
  cardHover:  '#FAFAF7',   // row hover / alt row

  // Borders
  border:     'rgba(0,0,0,0.08)',
  borderMid:  'rgba(0,0,0,0.12)',

  // Text
  text:       '#1C1917',   // stone-900
  textSub:    '#78716C',   // stone-500
  textMuted:  '#A8A29E',   // stone-400

  // Accent (black)
  accent:     '#1C1917',
  accentBg:   'rgba(28,25,23,0.08)',
  accentText: '#FFFFFF',

  // Semantic
  success:    '#16A34A',
  successBg:  'rgba(22,163,74,0.1)',
  warning:    '#D97706',
  warningBg:  'rgba(217,119,6,0.1)',
  danger:     '#DC2626',
  dangerBg:   'rgba(220,38,38,0.1)',
  info:       '#2563EB',
  infoBg:     'rgba(37,99,235,0.1)',

  // Input
  input:      'rgba(0,0,0,0.05)',
  inputBorder:'rgba(0,0,0,0.14)',
} as const;

// Subject / role palette stays vivid
export const SUBJECT_COLORS = ['#2563EB','#7C3AED','#059669','#D97706','#0EA5E9','#DC2626','#F59E0B','#10B981'];

export const ROLE_COLORS: Record<string,string> = {
  student:       '#2563EB',
  teacher:       '#059669',
  class_teacher: '#10B981',
  coordinator:   '#D97706',
  principal:     '#7C3AED',
  tech_admin:    '#DC2626',
};
