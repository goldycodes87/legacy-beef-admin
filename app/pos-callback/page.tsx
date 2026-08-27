'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Where the Square POS app returns after a charge started from this admin.
 * Square appends the transaction result as query params. This page just tells
 * Grant what happened and points back at Payments — the money itself shows up
 * through Square like any other POS sale, and gets recorded against the order
 * with the normal Record Payment flow.
 */
export default function PosCallbackPage() {
  const [status, setStatus] = useState<'ok' | 'error' | 'unknown'>('unknown');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // iOS returns ?data=<json>; Android returns individual params.
    const raw = q.get('data');
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.error_code) {
          setStatus('error');
          setDetail(String(d.error_code));
          return;
        }
        setStatus('ok');
        setDetail(d.transaction_id ? `Square transaction ${d.transaction_id}` : '');
        return;
      } catch {
        setStatus('unknown');
        return;
      }
    }
    const err = q.get('com.squareup.pos.ERROR_CODE');
    const txn = q.get('com.squareup.pos.SERVER_TRANSACTION_ID');
    if (err) {
      setStatus('error');
      setDetail(err);
    } else if (txn) {
      setStatus('ok');
      setDetail(`Square transaction ${txn}`);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface-2, #0f0f0f)' }}>
      <div className="max-w-sm w-full rounded-2xl p-8 text-center" style={{ background: 'var(--surface-1, #1a1a1a)', border: '1px solid var(--border, #333)' }}>
        <div className="text-5xl mb-4" aria-hidden="true">
          {status === 'ok' ? '✅' : status === 'error' ? '⚠️' : '💳'}
        </div>
        <h1 className="font-display font-bold text-2xl text-white mb-2">
          {status === 'ok' ? 'Payment taken' : status === 'error' ? 'Payment not completed' : 'Back from Square'}
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          {status === 'ok'
            ? 'Now record it against the order so the balance clears.'
            : status === 'error'
              ? `Square reported: ${detail || 'the charge did not go through'}. Nothing was recorded.`
              : 'If you completed a charge in Square, record it against the order so the balance clears.'}
        </p>
        {detail && status === 'ok' && <p className="text-xs text-gray-500 mb-6 break-all">{detail}</p>}
        <Link
          href="/payments"
          className="block w-full py-3 rounded-xl text-white font-semibold bg-brand-orange hover:bg-brand-orange-hover"
        >
          Back to Payments
        </Link>
      </div>
    </div>
  );
}
