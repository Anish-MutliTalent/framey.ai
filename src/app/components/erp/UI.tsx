/**
 * Shared primitives for the light-mode ERP UI.
 * Import T from theme and these components across all pages.
 */
import { CSSProperties, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { T } from '../../theme';

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', style = {} }: {
  children: ReactNode; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: T.card, border: `1px solid ${T.border}`, ...style }}>
      {children}
    </div>
  );
}

// ── Section heading inside a card ─────────────────────────────────────────────
export function CardHeader({ icon, label, aside }: {
  icon?: ReactNode; label: string; aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span style={{ color: T.accent }}>{icon}</span>}
      <h2 className="text-sm font-semibold" style={{ color: T.text }}>{label}</h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

// ── Pill badge ────────────────────────────────────────────────────────────────
export function Badge({ children, color = T.accent, bg }: {
  children: ReactNode; color?: string; bg?: string;
}) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color, background: bg ?? `${color}18` }}>
      {children}
    </span>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead><tr style={{ background: T.bgDeep }}>{children}</tr></thead>;
}
export function TH({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${className}`}
      style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
      {children}
    </th>
  );
}
export function TRow({ children, idx = 0 }: { children: ReactNode; idx?: number }) {
  return (
    <tr style={{ background: idx % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}` }}>
      {children}
    </tr>
  );
}
export function TD({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`} style={{ color: T.textSub }}>{children}</td>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center py-12 gap-2" style={{ color: T.textMuted }}>
      {icon}
      <span className="text-xs">{text}</span>
    </div>
  );
}

// ── Form input ────────────────────────────────────────────────────────────────
export function Input({ className = '', style = {}, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`w-full px-3 py-2 rounded-xl text-sm outline-none ${className}`}
      style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: T.text, ...style }}
      {...props} />
  );
}
export function Select({ className = '', style = {}, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`w-full px-3 py-2 rounded-xl text-sm outline-none appearance-none ${className}`}
      style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: T.text, ...style }}
      {...props}>
      {children}
    </select>
  );
}
export function Textarea({ className = '', style = {}, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`w-full px-3 py-2 rounded-xl text-sm outline-none resize-none ${className}`}
      style={{ background: T.input, border: `1px solid ${T.inputBorder}`, color: T.text, ...style }}
      {...props} />
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'danger';
export function Btn({ children, variant = 'primary', className = '', style = {}, ...props }:
  { variant?: BtnVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<BtnVariant, CSSProperties> = {
    primary: { background: T.accent, color: '#fff' },
    ghost:   { background: 'transparent', color: T.textSub, border: `1px solid ${T.border}` },
    danger:  { background: T.dangerBg, color: T.danger },
  };
  return (
    <button
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 ${className}`}
      style={{ ...styles[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────
export function Label({ children }: { children: ReactNode }) {
  return <label className="text-xs font-medium block mb-1" style={{ color: T.textSub }}>{children}</label>;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-2xl" style={{ background: T.bgDeep }} />
      ))}
    </div>
  );
}

// ── Modal overlay ─────────────────────────────────────────────────────────────
export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-6 w-full max-w-md shadow-xl"
        style={{ background: T.card, border: `1px solid ${T.border}` }}>
        {children}
      </div>
    </div>
  );
}
