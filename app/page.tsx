'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface DashboardData {
  total_animals: number;
  open_capacity: number;
  reservations_this_season: number;
  revenue_collected: number;
  pending_cut_sheets: number;
  cut_sheets_locked: number;
  awaiting_hanging_weight: number;
  beef_ready: number;
}

const CARDS = [
  { key: 'total_animals', label: 'Available Animals' },
  { key: 'open_capacity', label: 'Open Capacity (Units)' },
  { key: 'reservations_this_season', label: 'Reservations' },
  { key: 'revenue_collected', label: 'Revenue Collected' },
  { key: 'pending_cut_sheets', label: 'Pending Cut Sheets' },
  { key: 'cut_sheets_locked', label: 'Sheets Locked' },
  { key: 'awaiting_hanging_weight', label: 'Awaiting Hanging Weight' },
  { key: 'beef_ready', label: 'Beef Ready' },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-2xl shadow-sm p-6"
          >
            <p className="text-4xl font-bold text-brand-orange">
              {loading ? '...' : data?.[card.key as keyof DashboardData] ?? 0}
            </p>
            <p className="text-sm text-brand-gray mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
