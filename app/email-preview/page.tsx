'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

const EMAIL_TYPES = [
  { id: 'deposit_confirmation', label: 'Deposit Confirmation' },
  { id: 'partner_invite', label: 'Split Partner Invite' },
  { id: 'partner_deadline', label: 'Partner Deadline Warning' },
  { id: 'reminder_10day', label: '10-Day Cut Sheet Reminder' },
  { id: 'reminder_1day', label: '1-Day Cut Sheet Reminder' },
  { id: 'cut_sheet_locked', label: 'Cut Sheet Locked' },
  { id: 'auto_lock', label: 'Auto-Lock Notice' },
  { id: 'beef_ready', label: 'Beef Ready for Pickup' },
  { id: 'pickup_confirmed', label: 'Pickup Confirmed' },
  { id: 'balance_payment', label: 'Balance Payment Receipt' },
  { id: 'hanging_weight', label: 'Hanging Weight Notification' },
];

export default function EmailPreview() {
  const [selected, setSelected] = useState('deposit_confirmation');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/email-preview?type=${selected}`);
        const data = await res.json();
        setHtml(data.html);
      } catch (err) {
        console.error('Failed to load email preview:', err);
        setHtml('<p>Error loading email preview</p>');
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [selected]);

  return (
    <AdminLayout title="Email Preview">
      <div className="flex h-[calc(100vh-120px)] gap-0 bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Email Templates</h2>
            <p className="text-xs text-gray-500 mt-1">Mock Data - Read-Only</p>
          </div>
          <div className="p-4 space-y-2">
            {EMAIL_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelected(type.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                  selected === type.id
                    ? 'bg-brand-orange text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Pane */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm">
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
              Mock Data
            </span>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading preview...</p>
              </div>
            ) : (
              <iframe
                srcDoc={html}
                className="w-full h-full border-0 rounded-lg"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
