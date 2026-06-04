'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface Session {
  id: string;
  purchase_type: string;
  status: string;
  cut_sheet_complete: boolean;
  cut_sheet_locked_at: string;
  dual_cut_sheet?: boolean | null;
  half_a_complete?: boolean;
  half_b_complete?: boolean;
  half_a_locked_at?: string | null;
  half_b_locked_at?: string | null;
  hanging_weight_lbs: number | null;
  balance_due: number;
  balance_paid: boolean;
  deposit_amount: number;
  customers: { id: string; name: string; email: string; phone: string } | null;
  animals: Array<{ id: string; name: string; butcher_date: string; estimated_ready_date: string; animal_type: string; price_per_lb: number }> | null;
  cut_sheet_answers: Array<{ section: string; answers: Record<string, unknown>; completed: boolean; custom_request: string; custom_request_status: string; half?: 'A' | 'B' | null; locked?: boolean }>;
  last_viewed_at?: string | null;
}

function formatPurchaseType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1) + ' Beef';
}

function formatAnimalType(type: string): string {
  if (type === 'wagyu') return 'American Wagyu';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
}

const SECTION_ORDER = ['chuck','brisket','skirt','rib','short_ribs','sirloin','round','short_loin','flank','stew_meat','tenderized_round','organs','bones','packing'];
const SECTION_DISPLAY_NAMES: Record<string, string> = {
  chuck: 'Chuck',
  brisket: 'Brisket',
  skirt: 'Skirt Steak',
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
  const [confirmApprove, setConfirmApprove] = useState<{ sessionId: string; section: string; half?: 'A' | 'B' | null } | null>(null);
  const [confirmDeny, setConfirmDeny] = useState<{ sessionId: string; section: string; half?: 'A' | 'B' | null } | null>(null);
  const [confirmReady, setConfirmReady] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<{sessionId: string, section: string, answers: Record<string,unknown>, half?: 'A' | 'B' | null} | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<string,unknown>>({});
  const [saving, setSaving] = useState(false);

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

  const sessionRows = filtered.flatMap((session): Array<{ session: Session; half: 'A' | 'B' | null }> => {
    if (session.purchase_type === 'whole' && session.dual_cut_sheet) {
      return [
        { session, half: 'A' as const },
        { session, half: 'B' as const },
      ];
    }
    return [{ session, half: null as 'A' | 'B' | null }];
  });

  const answersForHalf = (s: Session, half: 'A' | 'B' | null) => {
    if (!s.dual_cut_sheet || half === null) {
      // Single cut sheet — return null-half answers only
      return s.cut_sheet_answers.filter(a => (a.half ?? null) === null);
    }
    // Dual cut sheet — for each section, prefer half-specific answer,
    // fall back to null (both halves) answer if no half-specific one exists
    const sections = [...new Set(s.cut_sheet_answers.map(a => a.section))];
    const result = [];
    for (const section of sections) {
      const halfSpecific = s.cut_sheet_answers.find(
        a => a.section === section && (a.half ?? null) === half
      );
      if (halfSpecific) {
        result.push(halfSpecific);
      } else {
        const bothHalves = s.cut_sheet_answers.find(
          a => a.section === section && (a.half ?? null) === null
        );
        if (bothHalves) result.push(bothHalves);
      }
    }
    return result;
  };

  const completedSections = (s: Session, half: 'A' | 'B' | null) =>
    answersForHalf(s, half).filter(a => a.completed).length;

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

  async function handleApproveCustom(sessionId: string, section: string, half?: 'A' | 'B' | null) {
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_request_action: { section, action: 'approved', half },
      }),
    });
    setConfirmApprove(null);
    load();
  }

  async function handleDenyCustom(sessionId: string, section: string, half?: 'A' | 'B' | null) {
    await fetch(`/api/admin/cut-sheets/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_request_action: { section, action: 'denied', half },
      }),
    });
    setConfirmDeny(null);
    load();
  }

  const handlePrintCutSheet = (sessionId: string) => {
    window.open(`/cut-sheets/${sessionId}/print`, '_blank');
  };

  const handleManualLock = async (sessionId: string) => {
    if (!confirm('Manually lock this cut sheet? Incomplete sections will use house defaults.')) return;
    const res = await fetch(`/api/admin/cut-sheets/${sessionId}/manual-lock`, {
      method: 'POST',
    });
    if (res.ok) load();
    else alert('Failed to lock cut sheet');
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
              className={`px-4 py-2 rounded-lg font-medium text-sm border ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
              style={filter === tab ? undefined : { background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              {tab === 'beef_ready' ? 'Beef Ready' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {sessionRows.map(({ session, half }) => {
            const animal = Array.isArray(session.animals) ? session.animals[0] : session.animals;
            const butcherDate = animal?.butcher_date ? new Date(animal.butcher_date) : null;
            const answersForRow = answersForHalf(session, half);
            const hasPassedButcher = butcherDate && butcherDate < new Date();
            const hasPendingCustom = answersForRow.some(
              a => a.custom_request && a.custom_request_status === 'pending'
            );
            const rowKey = `${session.id}-${half || 'single'}`;
            const halfLabel = half ? `Half ${half}` : null;

            return (
              <div key={rowKey} className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {/* Card Header */}
                <div className="bg-gradient-to-r from-green-700 to-green-800 text-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">{session.customers?.name}</span>
                      {halfLabel && (
                        <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                          {halfLabel}
                        </span>
                      )}
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                        {formatPurchaseType(session.purchase_type)}
                      </span>
                      <span className="bg-white/20 px-2 py-1 rounded text-xs font-semibold">
                        {formatAnimalType(animal?.animal_type || '')}
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
                      {completedSections(session, half)}/14 sections
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-4" style={{ background: 'var(--surface-1)' }}>
                  <div className="text-sm text-gray-300">
                    Last Viewed:{' '}
                    {session.last_viewed_at
                      ? new Date(session.last_viewed_at).toLocaleString()
                      : <span className="text-gray-400">Not yet opened</span>}
                  </div>
                  {/* Progress or Buttons */}
                  {!session.cut_sheet_complete ? (
                    <div className="space-y-2">
                      <div className="w-full rounded-full h-2" style={{ background: 'var(--surface-2)' }}>
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(completedSections(session, half) / 14) * 100}%`,
                          }}
                        />
                      </div>
                      {session.status !== 'locked' && (
                        <button
                          onClick={() => handleManualLock(session.id)}
                          className="text-brand-orange hover:text-brand-orange-hover font-semibold text-sm ml-3"
                        >
                          Lock Sheet
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedSheet(expandedSheet === rowKey ? null : rowKey)
                        }
                        className="flex-1 px-3 py-2 rounded font-medium text-sm"
                        style={{ background: 'var(--surface-2)', color: 'white', border: '1px solid var(--border)' }}
                      >
                        {expandedSheet === rowKey ? 'Hide' : 'View'} Full Cut Sheet
                      </button>
                      <button
                        onClick={() => handlePrintCutSheet(session.id)}
                        className="flex-1 px-3 py-2 rounded font-medium text-sm text-white hover:bg-white/5"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      >
                        Print Cut Sheet
                      </button>
                    </div>
                  )}

                  {/* Hanging Weight Section (show after butcher date passed) */}
                  {hasPassedButcher && (
                    <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-semibold text-white mb-3">Hanging Weight</p>
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
                          className="flex-1 px-3 py-2 border rounded text-sm bg-transparent text-white"
                          style={{ borderColor: 'var(--border)' }}
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
                        <p className="mt-2 text-sm font-semibold text-green-400">
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
                      {answersForRow
                        .filter(a => a.custom_request && a.custom_request_status === 'pending')
                        .map(answer => (
                          <div
                            key={`${session.id}-${answer.section}`}
                            className="bg-orange-50 border border-orange-200 rounded p-3 mb-3"
                          >
                            <p className="text-sm font-semibold text-orange-900 mb-2">
                              ⚠️ Custom Request: {SECTION_DISPLAY_NAMES[answer.section]} {halfLabel ? `(${halfLabel})` : ''}
                            </p>
                            <p className="text-sm text-orange-800 mb-3">{answer.custom_request}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  setConfirmApprove({ sessionId: session.id, section: answer.section, half })
                                }
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700"
                              >
                                Approve ✓
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeny({ sessionId: session.id, section: answer.section, half })
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
                {expandedSheet === rowKey && (
                  <div className="border-t p-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <p className="font-semibold text-white mb-3">Full Cut Sheet</p>
                    <table className="w-full">
                      <tbody>
                        {answersForRow
                          ?.sort((a: any, b: any) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section))
                          .map((answer: any) => {
                            const a = answer.answers || {};
                            const details: string[] = [];
                            if (a.house_default) details.push('House Default');
                            if (a.choice) details.push(String(a.choice).replace(/_/g, ' ').replace(/\b\w/g, (l:string) => l.toUpperCase()));
                            if (a.choices) details.push((a.choices as string[]).map((c:string) => c.replace(/_/g, ' ')).join(', '));
                            if (a.thickness) details.push(`${a.thickness} thick`);
                            if (a.tbone_thickness) details.push(`T-Bone: ${a.tbone_thickness}`);
                            if (a.strip_thickness) details.push(`Strip: ${a.strip_thickness}`);
                            if (a.filet_thickness) details.push(`Filet: ${a.filet_thickness}`);
                            if (a.steaks_per_pack) details.push(`${a.steaks_per_pack}/pack`);
                            if (a.roast_weight) details.push(`${a.roast_weight} lb roasts`);
                            if (a.fat_pct) details.push(`${a.fat_pct} fat`);
                            if (a.lbs_per_pack) details.push(`${a.lbs_per_pack} lb burger packs`);
                            if (a.pounds) details.push(`${a.pounds} lbs`);
                            if (a.pkg_size) details.push(`${a.pkg_size} packs`);
                            if (a.reason === 'round_not_steaks') details.push('N/A — Round not steaks');

                            return (
                              <tr key={answer.section} className="border-b" style={{ borderColor: 'var(--border)' }}>
                                <td className="py-3 px-4 font-semibold text-sm text-white w-40">
                                  {SECTION_DISPLAY_NAMES[answer.section] || answer.section}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-300">
                                  {details.join(' · ') || '—'}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {answer.custom_request && (
                                    <span className="text-amber-600 text-xs">⚠ {answer.custom_request}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setEditingSection({ sessionId: session.id, section: answer.section, answers: answer.answers, half });
                                      setEditAnswers(answer.answers);
                                    }}
                                    className="text-brand-orange text-xs font-semibold hover:underline"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
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
          <div className="rounded-lg p-6 max-w-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <p className="text-lg font-semibold text-white mb-4">
              Approve Custom Request? {confirmApprove.half ? `(Half ${confirmApprove.half})` : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmApprove(null)}
                className="flex-1 px-4 py-2 border rounded text-white font-medium hover:bg-white/5"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleApproveCustom(confirmApprove.sessionId, confirmApprove.section, confirmApprove.half)
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
          <div className="rounded-lg p-6 max-w-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <p className="text-lg font-semibold text-white mb-4">
              Deny Custom Request? {confirmDeny.half ? `(Half ${confirmDeny.half})` : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeny(null)}
                className="flex-1 px-4 py-2 border rounded text-white font-medium hover:bg-white/5"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDenyCustom(confirmDeny.sessionId, confirmDeny.section, confirmDeny.half)}
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
          <div className="rounded-lg p-6 max-w-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <p className="text-lg font-semibold text-white mb-4">Mark Beef Ready?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReady(null)}
                className="flex-1 px-4 py-2 border rounded text-white font-medium hover:bg-white/5"
                style={{ borderColor: 'var(--border)' }}
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

      {editingSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            <h3 className="font-bold text-lg text-white mb-4">
              Edit {SECTION_DISPLAY_NAMES[editingSection.section]} {editingSection.half ? `(Half ${editingSection.half})` : ''}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-white mb-2">
                Raw answers (JSON) — edit carefully
              </label>
              <textarea
                value={JSON.stringify(editAnswers, null, 2)}
                onChange={e => {
                  try { setEditAnswers(JSON.parse(e.target.value)); } catch {}
                }}
                rows={10}
                className="w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-orange bg-transparent text-white"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Valid choice keys: choice, choices, thickness, tbone_thickness, strip_thickness, filet_thickness, steaks_per_pack, roast_weight, fat_pct, lbs_per_pack, pounds, pkg_size
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setSaving(true);
                  await fetch(`/api/admin/cut-sheets/${editingSection.sessionId}/section`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section: editingSection.section, answers: editAnswers, half: editingSection.half }),
                  });
                  setSaving(false);
                  setEditingSection(null);
                  // Refresh cut sheets
                  const res = await fetch('/api/admin/cut-sheets');
                  setSessions(await res.json());
                }}
                disabled={saving}
                className="flex-1 bg-brand-orange text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingSection(null)}
                className="flex-1 border-2 py-3 rounded-xl font-semibold text-white hover:bg-white/5"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
