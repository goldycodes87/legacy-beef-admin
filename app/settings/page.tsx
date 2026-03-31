'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface PriceMatrix {
  price_whole_grass_fed: string;
  price_half_grass_fed: string;
  price_quarter_grass_fed: string;
  price_whole_grain_finished: string;
  price_half_grain_finished: string;
  price_quarter_grain_finished: string;
  price_whole_wagyu: string;
  price_half_wagyu: string;
  price_quarter_wagyu: string;
}

const DEFAULT_PRICES: PriceMatrix = {
  price_whole_grass_fed: '8.00',
  price_half_grass_fed: '8.25',
  price_quarter_grass_fed: '8.50',
  price_whole_grain_finished: '8.00',
  price_half_grain_finished: '8.25',
  price_quarter_grain_finished: '8.50',
  price_whole_wagyu: '9.50',
  price_half_wagyu: '9.75',
  price_quarter_wagyu: '10.00',
};

const ROWS = [
  { label: '🌿 Grass-Fed', whole: 'price_whole_grass_fed', half: 'price_half_grass_fed', quarter: 'price_quarter_grass_fed' },
  { label: '🌾 Grain-Finished', whole: 'price_whole_grain_finished', half: 'price_half_grain_finished', quarter: 'price_quarter_grain_finished' },
  { label: '⭐ American Wagyu', whole: 'price_whole_wagyu', half: 'price_half_wagyu', quarter: 'price_quarter_wagyu' },
];

export default function SettingsPage() {
  const [prices, setPrices] = useState<PriceMatrix>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(data => {
        if (!data.error) setPrices(prev => ({ ...prev, ...data }));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prices),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save prices. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h3 className="font-display font-bold text-xl text-brand-dark mb-1">Price Matrix</h3>
          <p className="text-sm text-brand-gray mb-6">
            Set price per lb by animal type and size. Changes apply to new butcher dates only — existing reservations are not affected.
          </p>

          {loading ? (
            <p className="text-brand-gray">Loading prices...</p>
          ) : (
            <form onSubmit={handleSave}>
              {/* Table header */}
              <div className="grid grid-cols-4 gap-4 mb-3">
                <div />
                {['Whole', 'Half', 'Quarter'].map(size => (
                  <p key={size} className="text-xs font-semibold text-brand-gray uppercase tracking-wider text-center">{size}</p>
                ))}
              </div>

              {/* Price rows */}
              <div className="space-y-4">
                {ROWS.map(row => (
                  <div key={row.label} className="grid grid-cols-4 gap-4 items-center">
                    <p className="text-sm font-semibold text-brand-dark">{row.label}</p>
                    {[row.whole, row.half, row.quarter].map(key => (
                      <div key={key} className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prices[key as keyof PriceMatrix]}
                          onChange={(e) => setPrices(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full pl-7 pr-3 py-2 border border-brand-gray-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange text-center"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Note */}
              <div className="mt-6 p-4 bg-brand-warm rounded-xl">
                <p className="text-xs text-brand-gray">
                  <span className="font-semibold text-brand-dark">Note:</span> These prices are used as defaults when creating new butcher dates. You can override individual animal prices when editing a butcher date.
                </p>
              </div>

              {/* Save button */}
              <div className="mt-6 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-orange hover:bg-brand-orange-hover text-white px-8 py-2.5 rounded-lg font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Prices'}
                </button>
                {saved && <p className="text-green-600 font-semibold text-sm">✓ Prices saved successfully</p>}
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>
            </form>
          )}
        </div>

        {/* Future settings placeholder */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mt-6">
          <h3 className="font-display font-bold text-xl text-brand-dark mb-1">More Settings</h3>
          <p className="text-sm text-brand-gray">Additional settings coming soon — deposit amounts, notification preferences, and more.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
