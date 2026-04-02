'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Session {
  id: string;
  purchase_type: string;
  customers: { name: string; email: string; phone: string } | null;
  animals: Array<{ name: string; butcher_date: string; animal_type: string }> | null;
}

interface CutSheetAnswer {
  section: string;
  answers: Record<string, unknown>;
  completed: boolean;
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

export default function PrintCutSheetPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<CutSheetAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sessionRes, answersRes] = await Promise.all([
        fetch(`/api/session/${sessionId}`),
        fetch(`/api/cut-sheet/${sessionId}`),
      ]);
      const sessionData = await sessionRes.json();
      const answersData = await answersRes.json();
      setSession(sessionData);
      setAnswers(Array.isArray(answersData) ? answersData : []);
      setLoading(false);
    }
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!loading && session) {
      // Auto-print when page loads
      setTimeout(() => window.print(), 500);
    }
  }, [loading, session]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading cut sheet...</div>
      </div>
    );
  }

  const animal = Array.isArray(session.animals)
    ? session.animals[0]
    : session.animals;

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-white print:p-0">
      {/* Header */}
      <div className="mb-8 border-b-2 border-gray-900 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cut Sheet</h1>
        <p className="text-sm text-gray-600">Legacy Land &amp; Cattle</p>
      </div>

      {/* Customer & Animal Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Customer
          </p>
          <p className="text-lg font-semibold text-gray-900">
            {session.customers?.name || '—'}
          </p>
          <p className="text-sm text-gray-600">{session.customers?.email}</p>
          <p className="text-sm text-gray-600">{session.customers?.phone}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Beef Details
          </p>
          <p className="text-lg font-semibold text-gray-900">
            {animal?.name || '—'}
          </p>
          <p className="text-sm text-gray-600">
            {animal?.animal_type || '—'} •{' '}
            {animal?.butcher_date
              ? new Date(animal.butcher_date + 'T00:00:00').toLocaleDateString(
                  'en-US',
                  { month: 'short', day: 'numeric', year: 'numeric' }
                )
              : '—'}
          </p>
          <p className="text-sm text-gray-600 capitalize">
            {session.purchase_type || '—'} Beef
          </p>
        </div>
      </div>

      {/* Cut Sheet Table */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Cut Selections</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left text-xs font-bold text-gray-900 py-2 px-2 w-24">
                Section
              </th>
              <th className="text-left text-xs font-bold text-gray-900 py-2 px-2 flex-1">
                Choice
              </th>
              <th className="text-left text-xs font-bold text-gray-900 py-2 px-2 flex-1">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {answers.map((answer, idx) => (
              <tr
                key={`${answer.section}-${idx}`}
                className={`${
                  idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                } border-b border-gray-200`}
              >
                <td className="text-sm font-semibold text-gray-900 py-3 px-2">
                  {SECTION_DISPLAY_NAMES[answer.section] || answer.section}
                </td>
                <td className="text-sm text-gray-700 py-3 px-2">
                  {answer.answers.choice as string ||
                    (Array.isArray(answer.answers.choices)
                      ? (answer.answers.choices as string[]).join(', ')
                      : '—')}
                </td>
                <td className="text-sm text-gray-600 py-3 px-2">
                  {Object.entries(answer.answers)
                    .filter(
                      ([key]) =>
                        !['choice', 'choices', 'house_default'].includes(key)
                    )
                    .map(([key, val]) => `${key}: ${val}`)
                    .join(' • ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-gray-900 pt-4 text-xs text-gray-600">
        <p>
          Cut Sheet ID: <span className="font-mono">{sessionId}</span>
        </p>
        <p>
          Generated:{' '}
          {new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .max-w-4xl {
            max-width: 100%;
          }
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
