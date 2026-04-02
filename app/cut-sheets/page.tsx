'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Session {
  id: string;
  purchase_type: string;
  status: string;
  cut_sheet_complete: boolean;
  cut_sheet_locked_at: string;
  hanging_weight_lbs: number | null;
  balance_due: number;
  balance_paid: boolean;
  deposit_amount: number;
  customers: { id: string; name: string; email: string; phone: string } | null;
  animals: Array<{ id: string; name: string; butcher_date: string; estimated_ready_date: string; animal_type: string; price_per_lb: number }> | null;
  cut_sheet_answers: Array<{ section: string; answers: Record<string, unknown>; completed: boolean; custom_request: string; custom_request_status: string }>;
}

const SECTION_DISPLAY_NAMES: Record<string, string> = {
  chuck: 'Chuck',
  brisket: 'Brisket',
  skirt: 'Skirt',
  rib: 'Rib',
  short_ribs: 'Short Ribs',
  sirloin: 'Sirloin',
  round: 'Round',
  short_loin: 'Short Loin',
  flank: 'Flank',
  stew_meat: 'Stew Meat',
  tenderized_round: 'Tenderized Round',
  organs: 'Organs',
  bones: 'Bones',
  packing: 'Packing',
};

export default function CutSheetsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [hangingWeights, setHangingWeights] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<{ sessionId: string; section: string } | null>(null);
  const [confirmDeny, setConfirmDeny] = useState<{ sessionId: string; section: string } | null>(null);
  const [confirmReady, setConfirmReady] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch('/api/admin/cut-sheets');
    const data = await res.json();
    setSessions(data);
    setLoading(false);
  }

  const filtered = sessions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !s.cut_sheet_complete;
    if (filter === 'locked') return s.cut_sheet_complete && s.status !== 'beef_ready';
    if (filter === 'beef_ready') return s.status === 'beef_ready';
    return true;
  });

  const completedSections = (s: Session) =>
    s.cut_sheet_answers.filter(a => a.completed).length;

  async function handleSaveHangingWeight(sessionId: string) {
    setSavingId(sessionId);
    const weight = hangingWeights[sessionId];
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hanging_weight_lbs: weight }),
    });
    setSavingId(null);
    load();
  }

  async function handleApproveCustom(sessionId: string, section: string) {
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_request_action: { section, action: 'approved' },
      }),
    });
    setConfirmApprove(null);
    load();
  }

  async function handleDenyCustom(sessionId: string, section: string) {
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_request_action: { section, action: 'denied' },
      }),
    });
    setConfirmDeny(null);
    load();
  }

  const handlePrintCutSheet = (sessionId: string) => {
    window.open(`/cut-sheets/${sessionId}/print`, '_blank');
  };

  async function handleMarkBeefReady(sessionId: string) {
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_beef_ready: true }),
    });
    setConfirmReady(null);
    load();
  }

  if (loading) {
    return <AdminLayout title="Cut Sheets"><div>Loading...</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Cut Sheets">
      <div className="space-y-6">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['all', 'pending', 'locked', 'beef_ready'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab === 'beef_ready' ? 'Beef Ready' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {filtered.map(session => {
            const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
            const butcherDate = animal?.butcher_date ? new Date(animal.butcher_date) : null;
            const hasPassedButcher = butcherDate && butcherDate < new Date();
            const hasPendingCustom = session.cut_sheet_answers.some(
              a => a.custom_request && a.custom_request_status === 'pending'
            );

            return (
              <div key={session.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Card Header */}
                <div className="bg-gradient-to-r from-green-700 to-green-800 text-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">{session.customers?.name}</span>
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                        {session.purchase_type}
                      </span>
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                        {animal?.animal_type || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="opacity-90">Butcher: {animal?.butcher_date || 'TBD'}</span>
                      <span className="mx-2 opacity-60">•</span>
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold capitalize">
                        {session.status}
                      </span>
                    </div>
                    <span className="font-semibold">
                      {completedSections(session)}/14 sections
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-4">
                  {/* Progress or Buttons */}
                  {!session.cut_sheet_complete ? (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(completedSections(session) / 14) * 100}%`,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedSheet(expandedSheet === session.id ? null : session.id)
                        }
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
                      >
                        {expandedSheet === session.id ? 'Hide' : 'View'} Full Cut Sheet
                      </button>
                      <button
                        onClick={() => handlePrintCutSheet(session.id)}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded font-medium text-sm hover:bg-gray-200"
                      >
                        Print Cut Sheet
                      </button>
                    </div>
                  )}

                  {/* Hanging Weight Section (show after butcher date passed) */}
                  {hasPassedButcher && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold text-gray-900 mb-3">Hanging Weight</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="lbs"
                          value={hangingWeights[session.id] || ''}
                          onChange={(e) =>
                            setHangingWeights({
                              ...hangingWeights,
                              [session.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => handleSaveHangingWeight(session.id)}
                          disabled={savingId === session.id}
                          className="px-4 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingId === session.id ? 'Saving...' : 'Save & Calculate'}
                        </button>
                      </div>
                      {hangingWeights[session.id] && (
                        <p className="mt-2 text-sm font-semibold text-green-700">
                          Balance Due: ${(hangingWeights[session.id] * (animal?.price_per_lb || 8) - session.deposit_amount).toFixed(2)}
                        </p>
                      )}
                      {hangingWeights[session.id] && (
                        <button
                          onClick={() => setConfirmReady(session.id)}
                          className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700"
                        >
                          Mark Beef Ready
                        </button>
                      )}
                    </div>
                  )}

                  {/* Custom Request Flags */}
                  {hasPendingCustom && (
                    <div className="border-t pt-4">
                      {session.cut_sheet_answers
                        .filter(a => a.custom_request && a.custom_request_status === 'pending')
                        .map(answer => (
                          <div
                            key={`${session.id}-${answer.section}`}
                            className="bg-orange-50 border border-orange-200 rounded p-3 mb-3"
                          >
                            <p className="text-sm font-semibold text-orange-900 mb-2">
                              ⚠️ Custom Request: {SECTION_DISPLAY_NAMES[answer.section]}
                            </p>
                            <p className="text-sm text-orange-800 mb-3">{answer.custom_request}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  setConfirmApprove({ sessionId: session.id, section: answer.section })
                                }
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700"
                              >
                                Approve ✓
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeny({ sessionId: session.id, section: answer.section })
                                }
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
                              >
                                Deny ✗
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Expanded Full Cut Sheet */}
                {expandedSheet === session.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="font-semibold text-gray-900 mb-3">Full Cut Sheet</p>
                    <div className="space-y-2">
                      {session.cut_sheet_answers.map(answer => (
                        <div
                          key={`${session.id}-${answer.section}`}
                          className="bg-white border border-gray-200 rounded p-3 grid grid-cols-3 gap-4 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {SECTION_DISPLAY_NAMES[answer.section]}
                            </p>
                          </div>
                          <div className="text-gray-600">
                            {(answer.answers.choice as string) || (answer.answers.choices as string[])?.join(', ') || '—'}
                          </div>
                          <div className="text-gray-600 text-right">
                            {Object.entries(answer.answers)
                              .filter(
                                ([key]) =>
                                  !['choice', 'choices', 'house_default'].includes(key)
                              )
                              .map(([key, val]) => `${key}: ${val}`)
                              .join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm Modals */}
      {confirmApprove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <p className="text-lg font-semibold mb-4">Approve Custom Request?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmApprove(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleApproveCustom(confirmApprove.sessionId, confirmApprove.section)
                }
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeny && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <p className="text-lg font-semibold mb-4">Deny Custom Request?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeny(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDenyCustom(confirmDeny.sessionId, confirmDeny.section)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReady && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <p className="text-lg font-semibold mb-4">Mark Beef Ready?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReady(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMarkBeefReady(confirmReady)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
              >
                Mark Ready
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
