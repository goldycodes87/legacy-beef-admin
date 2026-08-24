'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';

interface TemplateInfo {
  id: string;
  label: string;
  when: string;
}

/**
 * The template list comes from the server rather than a hardcoded array, so a
 * new email shows up here the moment it is added to email-content.ts and can
 * never quietly go missing from this page.
 */
export default function EmailPreview() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [when, setWhen] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/email-preview')
      .then((r) => r.json())
      .then((data) => {
        const list: TemplateInfo[] = data.templates || [];
        setTemplates(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/admin/email-preview?type=${selected}`)
      .then((r) => r.json())
      .then((data) => {
        setHtml(data.html || '<p>Could not render this template.</p>');
        setSubject(data.subject || '');
        setWhen(data.when || '');
      })
      .catch(() => setHtml('<p>Error loading email preview</p>'))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <AdminLayout title="Email Preview">
      <div
        className="flex flex-col lg:flex-row h-[calc(100vh-120px)] gap-0"
        style={{ background: 'var(--surface-2)' }}
      >
        {/* Sidebar */}
        <div
          className="w-full lg:w-72 overflow-y-auto border-b lg:border-b-0 lg:border-r shrink-0"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-lg font-bold text-white">Email Templates</h2>
            <p className="text-xs text-gray-400 mt-1">
              The real template, filled with sample data.
            </p>
          </div>
          <div className="p-4 space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                  selected === t.id
                    ? 'bg-brand-orange text-white'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview pane */}
        <div
          className="flex-1 flex flex-col min-w-0 rounded-lg shadow-sm border"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Subject</p>
                <h3 className="text-base font-semibold text-white break-words">
                  {subject || '—'}
                </h3>
              </div>
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full whitespace-nowrap">
                Sample data
              </span>
            </div>
            {when && <p className="text-sm text-gray-400 mt-3">{when}</p>}
          </div>
          <div className="flex-1 p-6 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">Loading preview…</p>
              </div>
            ) : (
              <iframe
                srcDoc={html}
                className="w-full h-full min-h-[600px] border-0 rounded-lg bg-white"
                title="Email preview"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
