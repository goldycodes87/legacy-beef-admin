'use client';

import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

/**
 * Chat with the employee. The conversation lives on the server and is shared
 * with the SMS and voice channels — this page renders it, sends new messages,
 * and answers approval cards. Voice input uses the browser's own speech
 * recognition where available (dictation on the phone keyboard covers iOS).
 */

interface ChatItem {
  who: string;
  text: string;
  channel?: string;
}

interface Pending {
  id: string;
  tool: string;
  input: Record<string, unknown>;
}

const TOOL_LABEL: Record<string, string> = {
  create_butcher_date: 'Create butcher date',
  adjust_capacity: 'Adjust capacity',
  update_persona: 'Update my persona',
};

const SUGGESTIONS = [
  'Give me a status update',
  'Who still owes me a deposit?',
  "What's left on upcoming butcher dates?",
  'Did Brenda get her emails?',
];

export default function AskPage() {
  const [agentName, setAgentName] = useState('Rusty');
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/ask')
      .then((r) => r.json())
      .then((data) => {
        setAgentName(data.name || 'Rusty');
        setChat(data.transcript || []);
        setPending(data.pending || null);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

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
      if (data.reply) setChat((c) => [...c, { who: 'assistant', text: data.reply }]);
      setPending(data.pending || null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || pending) return;
    setChat((c) => [...c, { who: 'user', text: trimmed }]);
    setInput('');
    void callApi({ text: trimmed });
  }

  function decide(approved: boolean) {
    if (!pending || busy) return;
    setChat((c) => [
      ...c,
      {
        who: 'system',
        text: `${approved ? '✅ Approved' : '🚫 Declined'}: ${TOOL_LABEL[pending.tool] || pending.tool}`,
      },
    ]);
    const id = pending.id;
    setPending(null);
    void callApi({ approval: { id, approved } });
  }

  return (
    <AdminLayout title={agentName}>
      <div className="flex flex-col h-[calc(100vh-130px)] max-w-3xl mx-auto">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {loaded && chat.length === 0 && (
            <div className="pt-10 text-center">
              <div className="text-5xl mb-4">🤠</div>
              <h2 className="font-display font-bold text-2xl text-white mb-2">
                {agentName} is on the clock.
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Status, reservations, capacity, emails — or have {agentName} set up a butcher
                date. Anything that changes data waits for your approval, here or by text.
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
            m.who === 'system' ? (
              <p key={i} className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {m.text}
              </p>
            ) : (
              <div key={i} className={`flex ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.who === 'user' ? 'bg-brand-orange text-white' : 'text-gray-200'
                  }`}
                  style={
                    m.who === 'user'
                      ? undefined
                      : { background: 'var(--surface-1)', border: '1px solid var(--border)' }
                  }
                >
                  {m.channel && m.channel !== 'web' && (
                    <span
                      className="block text-[10px] uppercase tracking-wider mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      via {m.channel}
                    </span>
                  )}
                  {m.text}
                </div>
              </div>
            )
          )}

          {pending && (
            <div
              className="rounded-2xl p-5 border-2"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--warning-border)' }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--warning-fg)' }}
              >
                Needs your approval
              </p>
              <p className="text-white font-semibold mb-3">
                {TOOL_LABEL[pending.tool] || pending.tool}
              </p>
              <dl className="text-sm mb-4 space-y-1">
                {Object.entries(pending.input).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt style={{ color: 'var(--text-secondary)' }}>{k.replace(/_/g, ' ')}:</dt>
                    <dd className="text-white font-medium break-all">{String(v)}</dd>
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
              {agentName} is working…
            </p>
          )}
          {error && (
            <p
              className="text-sm rounded-xl px-4 py-3"
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-fg)',
              }}
            >
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

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
            placeholder={pending ? 'Answer the approval above first…' : `Message ${agentName}…`}
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
