'use client';

import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

/**
 * Chat with the ops agent. The server owns the tools and the approval rules;
 * this page owns nothing but the transcript and the Approve/Cancel buttons.
 * Conversation state (full API content blocks) lives here and is replayed to
 * the route each turn.
 */

type ApiMessage = { role: string; content: unknown };

interface PendingAction {
  tool_use_id: string;
  tool: string;
  input: Record<string, unknown>;
}

interface ChatItem {
  who: 'you' | 'agent' | 'action';
  text: string;
}

const SUGGESTIONS = [
  'Give me a status update',
  "What's left for the next butcher date?",
  'Who still owes me a deposit?',
  'Did Brenda get her emails?',
];

const TOOL_LABEL: Record<string, string> = {
  create_butcher_date: 'Create butcher date',
  adjust_capacity: 'Adjust capacity',
};

export default function AskPage() {
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [siblingResults, setSiblingResults] = useState<unknown[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, pending, busy]);

  async function callApi(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setApiMessages(data.messages || []);
      if (data.pending_action) {
        setPending(data.pending_action);
        setSiblingResults(data.sibling_results || null);
      } else {
        setPending(null);
        setSiblingResults(null);
      }
      if (data.reply) setChat((c) => [...c, { who: 'agent', text: data.reply }]);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || pending) return;
    setChat((c) => [...c, { who: 'you', text: trimmed }]);
    setInput('');
    void callApi({ messages: [...apiMessages, { role: 'user', content: trimmed }] });
  }

  function decide(approved: boolean) {
    if (!pending || busy) return;
    setChat((c) => [
      ...c,
      {
        who: 'action',
        text: `${approved ? '✅ Approved' : '🚫 Declined'}: ${TOOL_LABEL[pending.tool] || pending.tool}`,
      },
    ]);
    const approval = {
      tool_use_id: pending.tool_use_id,
      approved,
      ...(siblingResults ? { sibling_results: siblingResults } : {}),
    };
    setPending(null);
    setSiblingResults(null);
    void callApi({ messages: apiMessages, approval });
  }

  return (
    <AdminLayout title="Ask">
      <div className="flex flex-col h-[calc(100vh-130px)] max-w-3xl mx-auto">
        {/* Transcript */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {chat.length === 0 && (
            <div className="pt-10 text-center">
              <div className="text-5xl mb-4">🤠</div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                Ask about the ranch.
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Status, reservations, capacity, emails — or tell it to set up a butcher date.
                Anything that changes data waits for your approval.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-4 py-2 rounded-full text-sm font-medium border text-gray-300 hover:bg-white/5"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.map((m, i) =>
            m.who === 'action' ? (
              <p key={i} className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.text}
              </p>
            ) : (
              <div key={i} className={`flex ${m.who === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.who === 'you' ? 'bg-brand-orange text-white' : 'text-gray-200'
                  }`}
                  style={
                    m.who === 'you'
                      ? undefined
                      : { background: 'var(--surface-1)', border: '1px solid var(--border)' }
                  }
                >
                  {m.text}
                </div>
              </div>
            )
          )}

          {/* Approval card */}
          {pending && (
            <div
              className="rounded-2xl p-5 border-2"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--warning-border)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning-fg)' }}>
                Needs your approval
              </p>
              <p className="text-white font-semibold mb-3">
                {TOOL_LABEL[pending.tool] || pending.tool}
              </p>
              <dl className="text-sm mb-4 space-y-1">
                {Object.entries(pending.input).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt style={{ color: 'var(--text-secondary)' }}>{k.replace(/_/g, ' ')}:</dt>
                    <dd className="text-white font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => decide(true)}
                  disabled={busy}
                  className="py-3 rounded-xl font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(false)}
                  disabled={busy}
                  className="py-3 rounded-xl font-semibold text-gray-300 border disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {busy && (
            <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
              Working…
            </p>
          )}
          {error && (
            <p
              className="text-sm rounded-xl px-4 py-3"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-fg)' }}
            >
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 pt-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={pending ? 'Answer the approval above first…' : 'Ask anything…'}
            disabled={busy || !!pending}
            className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none disabled:opacity-50"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
          />
          <button
            type="submit"
            disabled={busy || !!pending || !input.trim()}
            className="px-6 rounded-xl font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
