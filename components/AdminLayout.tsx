'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconButton } from './ui';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/animals', label: 'Butcher Dates', icon: '🐄' },
  { href: '/slots', label: 'Reservations', icon: '📋' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/cut-sheets', label: 'Cut Sheets', icon: '📝' },
  { href: '/payments', label: 'Payments', icon: '💳' },
  { href: '/financials', label: 'Financials', icon: '💰' },
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function PushSubscribeButton() {
  const [subscribed, setSubscribed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setSubscribed(localStorage.getItem('push_subscribed') === 'true');
  }, []);

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications not supported in this browser');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Please allow notifications to receive order updates');
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      alert('Push key missing. Ask an admin to set NEXT_PUBLIC_VAPID_PUBLIC_KEY.');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    localStorage.setItem('push_subscribed', 'true');
    setSubscribed(true);
    alert('Notifications enabled!');
  }

  return (
    <button
      onClick={subscribe}
      className="p-2 rounded-lg hover:bg-[color:var(--surface-2)] transition"
      title={subscribed ? 'Notifications enabled' : 'Enable notifications'}
    >
      {subscribed ? '🔔' : '🔕'}
    </button>
  );
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
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--surface-0)', color: 'var(--text)' }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="admin-sidebar"
        className={`
          fixed top-0 left-0 h-full flex flex-col z-40 transform transition-transform duration-300
          lg:relative lg:translate-x-0 lg:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: 'var(--sidebar-w)',
          background: 'var(--surface-1)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div
          className="p-6 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p className="type-app-title" style={{ color: 'var(--accent)' }}>
              Legacy Land
            </p>
            <h1 className="type-page-subtitle font-medium" style={{ color: 'var(--text)' }}>
              Beef Admin Panel
            </h1>
          </div>
          <IconButton
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            ✕
          </IconButton>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-semibold transition-colors border-l-2',
                  isActive
                    ? 'bg-[color:var(--surface-2)] border-l-[color:var(--accent)] text-[color:var(--text)]'
                    : 'border-l-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] hover:border-l-[color:var(--border-strong)]',
                ].join(' ')}
              >
                <span className="text-lg">{link.icon}</span>
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div
          className="p-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-semibold transition-colors border border-transparent hover:border-[color:var(--border)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]"
            style={{
              color: 'var(--text-muted)',
              background: 'transparent',
            }}
          >
            <span aria-hidden>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-auto min-w-0">
        <header
          className="flex items-center gap-3 px-4 py-3 sticky top-0 z-20"
          style={{
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2">
            <IconButton
              id="sidebar-toggle"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="12" x2="17" y2="12" />
                <line x1="3" y1="18" x2="17" y2="18" />
              </svg>
            </IconButton>
            <PushSubscribeButton />
          </div>
          {title && (
            <h2 className="type-page-title truncate">{title}</h2>
          )}
        </header>
        <div className="flex-1 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
