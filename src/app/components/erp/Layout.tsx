import { ReactNode } from 'react';
import { ERPSidebar } from './ERPSidebar';
import { TopBar } from './TopBar';
import { T } from '../../theme';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="flex min-h-screen" style={{ background: T.bg, color: T.text }}>
      <ERPSidebar />
      <div className="flex-1 flex flex-col ml-64">
        <TopBar title={title} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
