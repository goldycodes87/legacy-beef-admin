'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/animals', label: 'Butcher Dates', icon: '🐄' },
  { href: '/slots', label: 'Reservations', icon: '📋' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/cut-sheets', label: 'Cut Sheets', icon: '📝' },
  { href: '/payments', label: 'Payments', icon: '💳' },
  { href: '/coupons', label: 'Coupons', icon: '🏷️' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/settings', label: 'Prices & Settings', icon: '💲' },
  { href: '/pickup-windows', label: 'Pickup Windows', icon: '📅' },
  { href: '/pickup-schedule', label: 'Pickup Schedule', icon: '🗓️' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-brand-warm">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-dark text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="font-display text-xl font-bold leading-tight">Legacy Land<br />&amp; Cattle</h1>
          <p className="text-xs text-white/50 mt-1">Admin Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-orange text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto">
        <header className="bg-white border-b border-brand-gray-light px-8 py-4">
          <h2 className="font-display text-2xl font-bold text-brand-dark">{title}</h2>
        </header>
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
