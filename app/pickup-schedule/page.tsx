'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import AdminLayout from '@/components/AdminLayout';

interface Appointment {
  id: string;
  session_id: string;
  is_alternate_pickup: boolean;
  pickup_person_name: string;
  pickup_person_phone: string;
  sessions: { purchase_type: string };
  pickup_windows: { label: string; pickup_date: string; start_time: string; end_time: string };
  customers: { name: string };
}

export default function PickupSchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const fetchAppointments = async () => {
      const res = await fetch('/api/admin/pickup-appointments');
      const data = await res.json();
      setAppointments(data);
    };
    fetchAppointments();
  }, []);

  const grouped = appointments.reduce((acc, apt) => {
    const key = `${apt.pickup_windows.pickup_date}_${apt.pickup_windows.start_time}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  return (
    <AdminLayout title="Pickup Schedule">
      {Object.keys(grouped).length === 0 ? (
        <p className="text-brand-gray">No pickup appointments scheduled yet.</p>
      ) : (
        Object.entries(grouped).map(([key, apts]) => {
          const apt = apts[0];
          const dateStr = format(new Date(apt.pickup_windows.pickup_date), 'EEE, MMM d');
          const timeStr = `${apt.pickup_windows.start_time} – ${apt.pickup_windows.end_time}`;

          return (
            <div key={key} className="mb-8">
              <h2 className="text-xl font-bold mb-4">
                {dateStr} • {timeStr} • {apt.pickup_windows.label}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border px-4 py-2 text-left">Customer</th>
                      <th className="border px-4 py-2 text-left">Type</th>
                      <th className="border px-4 py-2 text-left">Pickup Person</th>
                      <th className="border px-4 py-2 text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apts.map((apt) => (
                      <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="border px-4 py-2">{apt.customers.name}</td>
                        <td className="border px-4 py-2 capitalize">{apt.sessions.purchase_type}</td>
                        <td className="border px-4 py-2">
                          {apt.is_alternate_pickup && '🚩 '}
                          {apt.pickup_person_name}
                        </td>
                        <td className="border px-4 py-2">{apt.pickup_person_phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </AdminLayout>
  );
}
