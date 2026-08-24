'use client';

import { useEffect, useRef } from 'react';

/**
 * Bottom sheet for touch. Replaces window.confirm/prompt for actions taken on
 * a phone, where a browser dialog is both off-brand and awkward to hit.
 */
export function ActionSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Stop the list behind the sheet from scrolling under a thumb.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 outline-none"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div
          aria-hidden="true"
          className="sm:hidden w-9 h-1 rounded-full mx-auto mb-4"
          style={{ background: 'var(--border-strong)' }}
        />
        <h2 className="text-lg font-semibold text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-sm mt-0.5 mb-4" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        <div className={subtitle ? '' : 'mt-4'}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Full-width tap target for a sheet. Sized for thumbs, not cursors.
 */
export function SheetAction({
  children,
  onClick,
  intent = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  intent?: 'default' | 'primary' | 'danger' | 'quiet';
  disabled?: boolean;
}) {
  const base =
    'w-full text-left rounded-xl px-4 py-3.5 text-[15px] font-semibold mb-2 disabled:opacity-50 transition-colors';

  if (intent === 'primary') {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={`${base} text-white bg-brand-orange hover:bg-brand-orange-hover`}>
        {children}
      </button>
    );
  }

  if (intent === 'quiet') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${base} text-center font-medium`}
        style={{ color: 'var(--text-secondary)' }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={base}
      style={{
        background: intent === 'danger' ? 'var(--danger-bg)' : 'var(--surface-2)',
        color: intent === 'danger' ? 'var(--danger-fg)' : 'var(--text)',
        border: `1px solid ${intent === 'danger' ? 'var(--danger-border)' : 'var(--border)'}`,
      }}
    >
      {children}
    </button>
  );
}
