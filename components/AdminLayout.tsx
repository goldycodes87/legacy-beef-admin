'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/animals', label: 'Butcher Dates', icon: '🐄' },
  { href: '/slots', label: 'Reservations', icon: '📋' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/cut-sheets', label: 'Cut Sheets', icon: '📝' },
  { href: '/payments', label: 'Payments', icon: '💳' },
  { href: '/coupons', label: 'Coupons', icon: '🏷️' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/email-preview', label: 'Email Preview', icon: '✉️' },
  { href: '/wagyu-waitlist', label: 'Wagyu Waitlist', icon: '⭐' },
  { href: '/settings', label: 'Prices & Settings', icon: '💲' },
  { href: '/pickup-windows', label: 'Pickup Windows', icon: '📅' },
  { href: '/pickup-schedule', label: 'Pickup Schedule', icon: '🗓️' },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on outside click
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: MouseEvent) => {
      const sidebar = document.getElementById('admin-sidebar');
      const toggle = document.getElementById('sidebar-toggle');
      if (sidebar && !sidebar.contains(e.target as Node) && toggle && !toggle.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-brand-warm">
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`
          fixed top-0 left-0 h-full w-72 bg-brand-dark text-white
          flex flex-col z-40 transform transition-transform duration-300
          lg:relative lg:translate-x-0 lg:w-64 lg:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold leading-tight">
              Legacy Land<br />&amp; Cattle
            </h1>
            <p className="text-xs text-white/50 mt-1">Admin Portal</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-orange text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-brand-gray-light px-4 py-3 flex items-center gap-4 sticky top-0 z-20">
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-brand-dark"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="12" x2="17" y2="12" />
              <line x1="3" y1="18" x2="17" y2="18" />
            </svg>
          </button>
          {title && (
            <h2 className="font-display text-xl font-bold text-brand-dark truncate">
              {title}
            </h2>
          )}
        </header>
        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
