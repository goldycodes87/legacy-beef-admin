'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Where the Square POS app returns after a charge started from this admin.
 *
 * When the charge began from an order's payment sheet, Square hands back the
 * order id and amount we sent along, plus its transaction id — and this page
 * records the card payment against the order automatically. Recording is
 * idempotent on the transaction id, so a reload can't double-book it.
 * Cash and check stay manual on purpose.
 */

interface PosState {
  sessionId: string;
  amountCents: number;
}

type Status =
  | 'working'
  | 'recorded'
  | 'already'
  | 'record_failed'
  | 'square_error'
  | 'no_context';

export default function PosCallbackPage() {
  const [status, setStatus] = useState<Status>('working');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    // iOS returns ?data=<json>; Android returns individual params.
    let txnId: string | null = null;
    let errorCode: string | null = null;
    let state: PosState | null = null;

    const raw = q.get('data');
    if (raw) {
      try {
        const d = JSON.parse(raw);
        errorCode = d.error_code || null;
        txnId = d.transaction_id || d.client_transaction_id || null;
        if (d.state) state = JSON.parse(d.state);
      } catch {
        /* fall through to the generic outcome */
      }
    } else {
      errorCode = q.get('com.squareup.pos.ERROR_CODE');
      txnId =
        q.get('com.squareup.pos.SERVER_TRANSACTION_ID') ||
        q.get('com.squareup.pos.CLIENT_TRANSACTION_ID');
      const meta = q.get('com.squareup.pos.RESULT_REQUEST_METADATA');
      if (meta) {
        try {
          state = JSON.parse(meta);
        } catch {
          /* ignore */
        }
      }
    }

    if (errorCode) {
      setStatus('square_error');
      setDetail(errorCode);
      return;
    }
    if (!txnId || !state?.sessionId || !state.amountCents) {
      // Charge may have succeeded, but we don't know which order it was for.
      setStatus('no_context');
      return;
    }

    setAmount(state.amountCents / 100);

    fetch(`/api/admin/sessions/${state.sessionId}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'card',
        amount: state.amountCents / 100,
        square_transaction_id: txnId,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setStatus('record_failed');
          setDetail(d.error || 'The payment could not be recorded.');
          return;
        }
        setStatus(d.already_recorded ? 'already' : 'recorded');
      })
      .catch(() => {
        setStatus('record_failed');
        setDetail('Could not reach the server.');
      });
  }, []);

  const view: Record<Status, { icon: string; title: string; body: string }> = {
    working: {
      icon: '⏳',
      title: 'Recording payment…',
      body: 'One second — writing this against the order.',
    },
    recorded: {
      icon: '✅',
      title: amount ? `$${amount.toFixed(2)} recorded` : 'Payment recorded',
      body: 'The card charge is on the books and the balance has been updated. Nothing else to do.',
    },
    already: {
      icon: '✅',
      title: 'Already recorded',
      body: 'This Square transaction was recorded earlier — the balance is already up to date.',
    },
    record_failed: {
      icon: '⚠️',
      title: 'Charge went through — recording failed',
      body: `Square took the payment, but it could not be written to the order automatically: ${detail} Record it by hand from the Payments tab.`,
    },
    square_error: {
      icon: '⚠️',
      title: 'Payment not completed',
      body: `Square reported: ${detail}. Nothing was charged or recorded.`,
    },
    no_context: {
      icon: '💳',
      title: 'Back from Square',
      body: 'If you completed a charge, record it against the order from the Payments tab so the balance clears.',
    },
  };

  const v = view[status];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-2, #0f0f0f)' }}
    >
      <div
        className="max-w-sm w-full rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface-1, #1a1a1a)', border: '1px solid var(--border, #333)' }}
      >
        <div className="text-5xl mb-4" aria-hidden="true">
          {v.icon}
        </div>
        <h1 className="font-display font-bold text-2xl text-white mb-2">{v.title}</h1>
        <p className="text-sm text-gray-400 mb-6">{v.body}</p>
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
