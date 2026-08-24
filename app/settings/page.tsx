'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

/**
 * Every price, deposit, and the card surcharge live in the `config` table.
 * Both the customer portal and this admin app read from it, so a change saved
 * here takes effect everywhere at once. Reservations already booked keep the
 * price and deposit they were quoted.
 */

const PRICE_ROWS = [
  { label: '🌿 Grass-Fed', type: 'grass_fed' },
  { label: '🌾 Grain-Finished', type: 'grain_finished' },
  { label: '⭐ American Wagyu', type: 'wagyu' },
];

const SIZES = [
  { key: 'whole', label: 'Whole' },
  { key: 'half', label: 'Half' },
  { key: 'quarter', label: 'Quarter' },
];

const DEPOSIT_COLS = [
  { suffix: 'whole_single', label: 'Whole' },
  { suffix: 'whole_split', label: 'Whole (split)' },
  { suffix: 'half', label: 'Half' },
  { suffix: 'half_split', label: 'Half (split)' },
  { suffix: 'quarter', label: 'Quarter' },
  { suffix: 'quarter_split', label: 'Quarter (split)' },
];

const DEPOSIT_ROWS = [
  { label: 'Standard', suffixExtra: '' },
  { label: 'Wagyu', suffixExtra: '_wagyu' },
];

const DEFAULTS: Record<string, string> = {
  price_whole_grass_fed: '8.00',
  price_half_grass_fed: '8.25',
  price_quarter_grass_fed: '8.50',
  price_whole_grain_finished: '8.00',
  price_half_grain_finished: '8.25',
  price_quarter_grain_finished: '8.50',
  price_whole_wagyu: '9.50',
  price_half_wagyu: '9.75',
  price_quarter_wagyu: '10.00',
  deposit_whole_single: '850',
  deposit_whole_split: '500',
  deposit_half: '500',
  deposit_half_split: '250',
  deposit_quarter: '250',
  deposit_quarter_split: '250',
  deposit_whole_single_wagyu: '850',
  deposit_whole_split_wagyu: '500',
  deposit_half_wagyu: '500',
  deposit_half_split_wagyu: '250',
  deposit_quarter_wagyu: '250',
  deposit_quarter_split_wagyu: '250',
  card_surcharge_pct: '3',
};

const inputClass =
  'w-full pl-7 pr-2 py-2 rounded-lg text-sm text-center bg-transparent text-white border focus:outline-none focus:ring-2 focus:ring-brand-orange';

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError('Could not load current settings. Showing defaults — save with care.');
          return;
        }
        setValues((prev) => ({ ...prev, ...data }));
      })
      .catch(() => setError('Could not load current settings. Showing defaults — save with care.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const invalid = Object.entries(values).find(([, v]) => {
      const n = parseFloat(v);
      return Number.isNaN(n) || n < 0;
    });
    if (invalid) {
      setError(`"${invalid[0]}" must be a number of 0 or more.`);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const panelStyle = { background: 'var(--surface-1)', borderColor: 'var(--border)' };

  return (
    <AdminLayout title="Settings">
      <form onSubmit={handleSave} className="max-w-4xl">
        {loading ? (
          <p className="text-gray-300">Loading settings…</p>
        ) : (
          <>
            {/* Price matrix */}
            <div className="rounded-2xl shadow-sm p-8 border" style={panelStyle}>
              <h3 className="font-display font-bold text-xl text-white mb-1">Price Matrix</h3>
              <p className="text-sm text-gray-300 mb-6">
                Price per lb of hanging weight, by animal type and size. Used across the
                website, booking flow, and contracts.
              </p>

              <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div />
                    {SIZES.map((s) => (
                      <p key={s.key} className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">
                        {s.label}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {PRICE_ROWS.map((row) => (
                      <div key={row.type} className="grid grid-cols-4 gap-4 items-center">
                        <p className="text-sm font-semibold text-white">{row.label}</p>
                        {SIZES.map((s) => {
                          const key = `price_${s.key}_${row.type}`;
                          return (
                            <div key={key} className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                aria-label={`${row.label} ${s.label} price per lb`}
                                value={values[key] ?? ''}
                                onChange={(e) => set(key, e.target.value)}
                                className={inputClass}
                                style={{ borderColor: 'var(--border)' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Deposit matrix */}
            <div className="rounded-2xl shadow-sm p-8 mt-6 border" style={panelStyle}>
              <h3 className="font-display font-bold text-xl text-white mb-1">Deposit Matrix</h3>
              <p className="text-sm text-gray-300 mb-6">
                Deposit due at booking. Split deposits apply when a customer shares an
                animal with a partner.
              </p>

              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-7 gap-3 mb-3">
                    <div />
                    {DEPOSIT_COLS.map((c) => (
                      <p key={c.suffix} className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">
                        {c.label}
                      </p>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {DEPOSIT_ROWS.map((row) => (
                      <div key={row.label} className="grid grid-cols-7 gap-3 items-center">
                        <p className="text-sm font-semibold text-white">{row.label}</p>
                        {DEPOSIT_COLS.map((c) => {
                          const key = `deposit_${c.suffix}${row.suffixExtra}`;
                          return (
                            <div key={key} className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                aria-label={`${row.label} ${c.label} deposit`}
                                value={values[key] ?? ''}
                                onChange={(e) => set(key, e.target.value)}
                                className={inputClass}
                                style={{ borderColor: 'var(--border)' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card surcharge */}
            <div className="rounded-2xl shadow-sm p-8 mt-6 border" style={panelStyle}>
              <h3 className="font-display font-bold text-xl text-white mb-1">Card Surcharge</h3>
              <p className="text-sm text-gray-300 mb-6">
                Added to card payments (deposits and balances) and shown to the customer
                at checkout. Set to 0 to stop surcharging.
              </p>

              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    aria-label="Card surcharge percentage"
                    value={values.card_surcharge_pct ?? ''}
                    onChange={(e) => set('card_surcharge_pct', e.target.value)}
                    className="w-full pl-3 pr-8 py-2 rounded-lg text-sm bg-transparent text-white border focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <p className="text-xs text-gray-400">
                  Card network rules and some state laws limit surcharges, and debit cards
                  generally cannot be surcharged at all. Confirm your rate before changing it.
                </p>
              </div>
            </div>

            {/* Save */}
            <div
              className="rounded-2xl shadow-sm p-6 mt-6 border flex flex-wrap items-center gap-4"
              style={panelStyle}
            >
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-orange hover:bg-brand-orange-hover text-white px-8 py-2.5 rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              {saved && <p className="text-green-400 font-semibold text-sm">✓ Saved — live everywhere now</p>}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <p className="text-xs text-gray-400 basis-full">
                Existing reservations keep the price and deposit they were quoted at booking.
              </p>
            </div>
          </>
        )}
      </form>
    </AdminLayout>
  );
}
