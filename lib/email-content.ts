/**
 * Every customer-facing email, in one place.
 *
 * The sending routes and the admin's email preview both build from this
 * registry, so the preview shows the email that actually goes out. They used to
 * be separate implementations: the preview rendered a polished mock while the
 * "your beef is ready" email customers received was unbranded hand-rolled HTML
 * quoting a hardcoded $8.25/lb.
 *
 * This file is mirrored byte-for-byte in legacy-beef-admin/lib/email-content.ts
 * — the same arrangement money.ts and email-templates.ts already use. Change one,
 * change the other.
 */
import { emailBase, ctaButton, orderCard, cutSheetSummary } from '@/lib/email-templates';

export interface BuiltEmail {
  subject: string;
  html: string;
}

const PHONE = '(719) 258-1777';
/** Given to customers only. Never on the public site. */
const PICKUP_ADDRESS = '6105 Burgess Rd, Colorado Springs CO 80908';

function hero(
  emoji: string,
  headline: string,
  subhead: string,
  tone: 'green' | 'amber' = 'green'
): string {
  const bg = tone === 'green'
    ? { color: '#1A3D2B', gradient: 'linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%)', sub: '#C4A46B' }
    : { color: '#92400e', gradient: 'linear-gradient(135deg,#92400e 0%,#b45309 100%)', sub: '#fde68a' };
  return `<table role="presentation" width="100%" style="border-radius:12px;margin:0 0 28px;"><tr><td bgcolor="${bg.color}" style="background:${bg.gradient};border-radius:12px;padding:28px 24px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">${emoji}</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">${headline}</h2>
      <p style="color:${bg.sub};font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">${subhead}</p>
    </td></tr></table>`;
}

function para(text: string): string {
  return `<p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">${text}</p>`;
}

function note(title: string, body: string, tone: 'cream' | 'green' | 'amber' = 'cream'): string {
  const t = tone === 'green'
    ? { bg: '#F0F7E8', border: '#c3dfa0', head: '#1A3D2B' }
    : tone === 'amber'
      ? { bg: '#fef3c7', border: '#fcd34d', head: '#92400e' }
      : { bg: '#F9F6F1', border: '#E5E0D8', head: '#1A3D2B' };
  return `<div style="background:${t.bg};border:1px solid ${t.border};border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      ${title ? `<p style="font-family:Arial,sans-serif;font-size:14px;color:${t.head};margin:0 0 6px;font-weight:bold;">${title}</p>` : ''}
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;line-height:1.8;">${body}</p>
    </div>`;
}

function fineprint(text: string): string {
  return `<p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:8px;">${text}</p>`;
}

function money(n: number): string {
  return '$' + n.toFixed(2);
}

/** What to bring to pickup, shared by the ready and confirmed emails. */
function whatToBring(balanceDue: number): string {
  return note(
    '📦 What to bring',
    `&bull; A cooler or two — we can also help load straight into your vehicle<br>
     &bull; A quarter fills ~2 boxes, a half fills ~4, a whole fills 8–10<br>
     &bull; ${balanceDue > 0 ? 'Your remaining balance — cash, check, or card accepted' : "You're all paid up — nothing to bring but yourself"}`
  );
}

/**
 * The cut sheet sections, in the order the customer answers them. Used to name
 * what is still outstanding in the reminder emails — those used to say only
 * "3 section(s) still need attention", and counted only sections that had been
 * started, so a sheet nobody had touched reported nothing outstanding at all.
 */
export const CUT_SHEET_SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'chuck', label: 'Chuck' },
  { id: 'brisket', label: 'Brisket' },
  { id: 'skirt', label: 'Skirt Steak' },
  { id: 'rib', label: 'Rib' },
  { id: 'short_ribs', label: 'Short Ribs' },
  { id: 'sirloin', label: 'Sirloin' },
  { id: 'round', label: 'Round' },
  { id: 'short_loin', label: 'Short Loin' },
  { id: 'flank', label: 'Flank' },
  { id: 'stew_meat', label: 'Stew Meat' },
  { id: 'tenderized_round', label: 'Tenderized Round' },
  { id: 'organs', label: 'Organs' },
  { id: 'bones', label: 'Bones' },
  { id: 'packing', label: 'Ground Beef' },
];

/** Labels of the sections this order has not finished yet. */
export function outstandingSections(
  answers: Array<{ section: string; completed?: boolean | null }> | null | undefined
): string[] {
  const done = new Set((answers || []).filter((a) => a.completed).map((a) => a.section));
  return CUT_SHEET_SECTIONS.filter((s) => !done.has(s.id)).map((s) => s.label);
}

export interface EmailTemplate<P> {
  /** Shown in the admin preview list. */
  label: string;
  /** When this email fires, in plain language. */
  when: string;
  subject: (p: P) => string;
  content: (p: P) => string;
  preheader: (p: P) => string;
  /** Realistic data so the preview renders without a live order. */
  sample: P;
}

export function build<P>(t: EmailTemplate<P>, p: P): BuiltEmail {
  return { subject: t.subject(p), html: emailBase(t.content(p), t.preheader(p)) };
}

// ─── Deposit confirmation ───────────────────────────────────────────────────
// Fired by the portal on a card payment and by the admin when a cash or check
// deposit is marked. Those were two different emails and card payers got the
// shorter one. Both build from here now.
export interface DepositConfirmationParams {
  firstName: string;
  purchaseLabel: string;
  animalName: string;
  butcherDate: string;
  estimatedReady: string | null;
  pricePerLb: number;
  depositPaid: number;
  cutSheetUrl: string;
  /** True when the cut sheet was already finished before the deposit landed. */
  cutSheetDone: boolean;
}

export const depositConfirmation: EmailTemplate<DepositConfirmationParams> = {
  label: 'Deposit confirmation',
  when: 'The moment a deposit is paid — by card in the portal, or when you mark cash/check in the admin.',
  subject: () => 'Your Legacy Land & Cattle Reservation is Confirmed',
  preheader: (p) =>
    p.cutSheetDone
      ? 'We got your deposit — you&rsquo;re all set.'
      : 'We got your deposit — your cut sheet is live.',
  content: (p) => `
    ${hero(
      '🎉',
      `You&rsquo;re in, ${p.firstName}.`,
      p.cutSheetDone
        ? 'We got your deposit — you&rsquo;re all set.'
        : 'We got your deposit — your cut sheet is live.'
    )}
    ${para(
      p.cutSheetDone
        ? 'We&rsquo;ve got your deposit — thank you. Your reservation is officially on the books, and since your cut sheet is already locked in, there&rsquo;s nothing else you need to do. This is real, ranch-direct beef raised right here in Colorado Springs — no grocery store, no middleman. Just our cattle, our butcher, and your freezer.'
        : 'We&rsquo;ve got your deposit — thank you. Your reservation is officially on the books and your cut sheet is open and waiting for you. This is real, ranch-direct beef raised right here in Colorado Springs — no grocery store, no middleman. Just our cattle, our butcher, and your freezer.'
    )}
    ${orderCard([
      { label: 'Order Type', value: p.purchaseLabel },
      { label: 'Animal', value: p.animalName },
      { label: 'Butcher Date', value: p.butcherDate },
      ...(p.estimatedReady ? [{ label: 'Est. Ready', value: p.estimatedReady }] : []),
      { label: 'Price/lb', value: money(p.pricePerLb) },
      { label: 'Deposit Paid', value: money(p.depositPaid) },
    ])}
    ${para(
      p.cutSheetDone
        ? '<strong style="color:#1A3D2B;">What happens next:</strong> We hand your cut sheet to T-K Processing before butcher day, and we&rsquo;ll email you when your beef is weighed and again when it&rsquo;s ready for pickup.'
        : '<strong style="color:#1A3D2B;">Your next step:</strong> Fill out your cut sheet — that&rsquo;s where you tell the butcher exactly how you want your beef cut. Steak thickness, roast size, ground beef ratio, all of it.'
    )}
    ${ctaButton(p.cutSheetDone ? 'View My Order →' : 'Build My Cut Sheet →', p.cutSheetUrl)}
    ${fineprint('This link is yours — bookmark it for easy access anytime.')}
  `,
  sample: {
    firstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    animalName: 'October 2026 — Grass-Fed',
    butcherDate: 'October 7, 2026',
    estimatedReady: 'November 8, 2026',
    pricePerLb: 8.5,
    depositPaid: 500,
    cutSheetUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
    cutSheetDone: false,
  },
};

// ─── Cut sheet invite ───────────────────────────────────────────────────────
export interface CutSheetInviteParams {
  firstName: string;
  purchaseLabel: string;
  animalName: string;
  butcherDate: string;
  estimatedReady: string | null;
  pricePerLb: number;
  cutSheetUrl: string;
}

export const cutSheetInvite: EmailTemplate<CutSheetInviteParams> = {
  label: 'Cut sheet invite',
  when: 'Sent by hand from the admin when you want a customer to start their cut sheet.',
  subject: (p) => `Time to build your cut sheet — Butcher date: ${p.butcherDate}`,
  preheader: () => 'This is the fun part — tell us exactly how you want it cut.',
  content: (p) => `
    ${hero('✂️', `Time to build your cut sheet, ${p.firstName}.`, `Butcher date: ${p.butcherDate}`)}
    ${para(
      'We know life gets busy — but this is the fun part. Tell us exactly how you want your beef cut: steaks, roasts, ground beef, stew meat, bones for broth. It&rsquo;s all yours.'
    )}
    ${orderCard([
      { label: 'Order Type', value: p.purchaseLabel },
      { label: 'Animal', value: p.animalName },
      { label: 'Price/lb', value: money(p.pricePerLb) },
      ...(p.estimatedReady ? [{ label: 'Ready by', value: p.estimatedReady }] : []),
    ])}
    ${note(
      '🏠 Not sure what to pick?',
      'Choose our Legacy House Cut — a well-rounded selection that maximizes your beef and puts variety in your freezer.',
      'green'
    )}
    ${ctaButton('Build My Cut Sheet →', p.cutSheetUrl)}
    ${fineprint('This link goes straight to your order — no login needed.')}
  `,
  sample: {
    firstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    animalName: 'October 2026 — Grass-Fed',
    butcherDate: 'October 7, 2026',
    estimatedReady: 'November 8, 2026',
    pricePerLb: 8.5,
    cutSheetUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
  },
};

// ─── Cut sheet reminders ────────────────────────────────────────────────────
export interface ReminderParams {
  firstName: string;
  butcherDate: string;
  cutSheetUrl: string;
  /** Sections still unanswered. Rendered as a checklist when present. */
  incompleteSections: string[];
}

function incompleteList(sections: string[]): string {
  if (sections.length === 0) return '';
  return note('📋 Still to decide', sections.map((s) => `&bull; ${s}`).join('<br>'));
}

export const reminder10Day: EmailTemplate<ReminderParams> = {
  label: 'Cut sheet reminder — 10 days',
  when: 'Automatically, 10 days before a butcher date, to anyone whose cut sheet is not finished.',
  subject: () => 'Your cut sheet is due in 10 days 🥩',
  preheader: () => 'It takes about 10 minutes, and this is the fun part.',
  content: (p) => `
    ${hero('✂️', `Time to build your cut sheet, ${p.firstName}.`, `Butcher date: ${p.butcherDate}`)}
    ${para(
      'We know life gets busy — but this is the fun part. Your cut sheet is where you tell our butcher <strong>exactly</strong> how you want your beef cut. Steak thickness, roast sizes, how much ground beef, whether you want bones or organs — all of it is up to you.'
    )}
    ${para(
      'You&rsquo;ve got <strong>10 days</strong> to get it done before we hand it off to T-K Processing. It takes about 10 minutes.'
    )}
    ${incompleteList(p.incompleteSections)}
    ${note(
      '🏠 Not sure what to pick?',
      'No problem — our Legacy House Cut is a well-rounded selection that works great for most families. You can choose it with one click inside the cut sheet wizard.',
      'green'
    )}
    ${ctaButton('Build My Cut Sheet →', p.cutSheetUrl, '#1A3D2B')}
    ${fineprint('This link goes straight to your order — no login needed.')}
  `,
  sample: {
    firstName: 'Sarah',
    butcherDate: 'October 7, 2026',
    cutSheetUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
    incompleteSections: ['Chuck', 'Round', 'Ground Beef'],
  },
};

export const reminderLastCall: EmailTemplate<ReminderParams> = {
  label: 'Cut sheet reminder — last call',
  when: 'Automatically, the day before the cut sheet auto-locks (8 days before the butcher date).',
  subject: () => 'Last call — your cut sheet locks tomorrow 🔒',
  preheader: () => 'Whatever is in there tomorrow is what gets cut.',
  content: (p) => `
    ${hero('⏰', `Last call, ${p.firstName}.`, 'Your cut sheet locks tomorrow.', 'amber')}
    ${para(
      'Tomorrow we hand your cut sheet to T-K Processing — whatever&rsquo;s in there is what gets cut. If yours isn&rsquo;t done, we&rsquo;ll fill it with our <strong>Legacy House Cut</strong>, which is a solid, well-rounded selection. But your custom preferences will always be better.'
    )}
    ${para('It takes 10 minutes. You&rsquo;ve got until end of day.')}
    ${incompleteList(p.incompleteSections)}
    ${note('', '⚠️ After tomorrow, your cut sheet will be locked and cannot be changed.', 'amber')}
    ${ctaButton('Complete My Cut Sheet Now →', p.cutSheetUrl)}
    ${fineprint('Happy with the house defaults? No action needed — we&rsquo;ve got you covered.')}
  `,
  sample: {
    firstName: 'Sarah',
    butcherDate: 'October 7, 2026',
    cutSheetUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
    incompleteSections: ['Chuck', 'Round'],
  },
};

// ─── Auto-locked with house defaults ────────────────────────────────────────
export interface AutoLockParams {
  firstName: string;
  butcherDate: string;
  answers: Array<{ section: string; answers: Record<string, unknown> }>;
}

export const autoLocked: EmailTemplate<AutoLockParams> = {
  label: 'Cut sheet auto-locked',
  when: 'Automatically, 7 days before the butcher date, when a cut sheet was never finished.',
  subject: () => 'Your cut sheet has been locked 🔒',
  preheader: () => 'We filled it with the Legacy House Cut.',
  content: (p) => `
    ${hero('🏠', `We&rsquo;ve got you covered, ${p.firstName}.`, 'Your cut sheet is locked and on its way to the butcher.')}
    ${para(
      'Life gets busy — we get it. Since your cut sheet deadline passed, we&rsquo;ve locked it in using our <strong>Legacy House Cut</strong>. It&rsquo;s a well-rounded selection our team put together that works great for most families.'
    )}
    ${note(
      '🥩 What&rsquo;s in the Legacy House Cut?',
      'A great mix of steaks, roasts, and ground beef — cut at standard thickness and packaged for easy freezer storage. You&rsquo;re going to love it.',
      'green'
    )}
    ${cutSheetSummary(p.answers)}
    ${para(
      `Have a specific request before ${p.butcherDate}? Reply to this email and we&rsquo;ll do our best to make it happen.`
    )}
  `,
  sample: {
    firstName: 'Sarah',
    butcherDate: 'October 7, 2026',
    answers: [
      { section: 'chuck', answers: { choice: 'steaks', thickness: '1"' } },
      { section: 'packing', answers: { fat_pct: '85/15', lbs_per_pack: 1 } },
    ],
  },
};

// ─── Cut sheet locked by the customer ───────────────────────────────────────
export interface CutSheetLockedParams {
  firstName: string;
  butcherDate: string;
  reviewUrl: string;
  /** True when this is a dual A/B sheet and both halves just completed. */
  bothHalves: boolean;
  answers: Array<{ section: string; answers: Record<string, unknown>; half?: string | null }>;
}

function lockedSummary(p: CutSheetLockedParams): string {
  if (!p.bothHalves) return cutSheetSummary(p.answers);
  const a = p.answers.filter((x) => (x.half ?? null) === 'A');
  const b = p.answers.filter((x) => (x.half ?? null) === 'B');
  const label = (t: string, top: string) =>
    `<p style="font-family:Arial,sans-serif;font-size:13px;color:#1A3D2B;margin:${top} 0 6px;font-weight:bold;">${t}</p>`;
  return `${label('HALF A', '12px')}${cutSheetSummary(a)}${label('HALF B', '16px')}${cutSheetSummary(b)}`;
}

export const cutSheetLocked: EmailTemplate<CutSheetLockedParams> = {
  label: 'Cut sheet locked',
  when: 'The moment a customer locks their own cut sheet.',
  subject: (p) =>
    p.bothHalves
      ? 'Your cut sheet is locked ✅ — both halves confirmed'
      : `Your cut sheet is locked, ${p.firstName} ✅`,
  preheader: (p) =>
    p.bothHalves
      ? `Nice work, ${p.firstName} — both halves are confirmed.`
      : `Nice work, ${p.firstName} — your cut sheet is done.`,
  content: (p) => `
    ${hero(
      '✅',
      p.bothHalves ? 'Both halves are locked in.' : `Your cut sheet is done, ${p.firstName}.`,
      p.bothHalves ? 'We have instructions for Half A and Half B.' : 'We&rsquo;ve got your cutting instructions.'
    )}
    ${para(
      p.bothHalves
        ? 'Your cut sheets are locked and will be hand-delivered to T-K Processing in Cañon City before butcher day.'
        : 'You just made the most important decision of this whole process — and we&rsquo;ve got every detail. Your cut sheet is locked and will be hand-delivered to T-K Processing in Cañon City before your butcher date.'
    )}
    ${note(
      '📅 What happens next',
      '1. We take your cut sheet to T-K Processing<br>2. Your beef is dry-aged 21–24 days<br>3. Cut, vacuum-sealed, and labeled to your specs<br>4. We&rsquo;ll email you when it&rsquo;s ready for pickup'
    )}
    ${lockedSummary(p)}
    <a href="${p.reviewUrl}" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;margin:24px 0 8px;">Review My Cut Sheet →</a>
    ${fineprint(`Questions before ${p.butcherDate}? Reply to this email and we&rsquo;ll do our best to accommodate.`)}
  `,
  sample: {
    firstName: 'Sarah',
    butcherDate: 'October 7, 2026',
    reviewUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
    bothHalves: false,
    answers: [{ section: 'chuck', answers: { choice: 'steaks', thickness: '1"' } }],
  },
};

export const cutSheetLockedPartner: EmailTemplate<CutSheetLockedParams> = {
  label: 'Cut sheet locked — split partner',
  when: 'To the other person on a split, at the same moment the shared cut sheet locks.',
  subject: (p) => (p.bothHalves ? 'Both halves are locked 🔒' : 'Your cut sheet is locked in 🔒'),
  preheader: () => 'Nice work — your beef order is all set.',
  content: (p) => `
    ${hero(
      '🔒',
      p.bothHalves ? 'Both halves are locked. Nice work!' : `Your cut sheet is locked, ${p.firstName}.`,
      'We&rsquo;ll get it to the butcher before your animal goes in.'
    )}
    ${para(
      'We&rsquo;ve got your cutting instructions and we&rsquo;ll make sure they get to the butcher before your animal goes in. Here&rsquo;s a summary of what you ordered:'
    )}
    ${lockedSummary(p)}
    ${fineprint('Questions or changes before butcher day? Reply to this email and we&rsquo;ll do our best to accommodate.')}
  `,
  sample: cutSheetLocked.sample,
};

// ─── Hanging weight and final balance ───────────────────────────────────────
export interface HangingWeightParams {
  firstName: string;
  purchaseLabel: string;
  hangingWeight: number;
  pricePerLb: number;
  totalCost: number;
  depositPaid: number;
  discountAmount: number;
  discountNote: string | null;
  balanceDue: number;
  payUrl: string;
}

export const hangingWeight: EmailTemplate<HangingWeightParams> = {
  label: 'Hanging weight & balance',
  when: 'When you enter a hanging weight in the admin.',
  subject: (p) => `Your hanging weight is in, ${p.firstName}`,
  preheader: () => "Here's your final balance.",
  content: (p) => `
    ${hero('&#9878;', `Your hanging weight is in, ${p.firstName}.`, 'Here&rsquo;s your final balance.')}
    ${para(
      'Your beef has been harvested and weighed. This is the final hanging weight — the number your balance is calculated from. Everything looks great.'
    )}
    ${orderCard([
      { label: 'Order', value: p.purchaseLabel },
      { label: 'Hanging Weight', value: `${p.hangingWeight} lbs` },
      { label: 'Price Per Lb', value: `${money(p.pricePerLb)}/lb` },
      { label: 'Total Cost', value: money(p.totalCost) },
      { label: 'Deposit Paid', value: `-${money(p.depositPaid)}` },
      ...(p.discountAmount > 0
        ? [
            {
              label: p.discountNote ? `Discount — ${p.discountNote}` : 'Discount',
              value: `-${money(p.discountAmount)}`,
            },
          ]
        : []),
      { label: 'Balance Due', value: money(p.balanceDue) },
    ])}
    ${para('You can pay your balance now online, or bring payment at pickup — cash, check, or card all work.')}
    ${ctaButton('Pay My Balance Now →', p.payUrl)}
    ${fineprint(`Questions? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    firstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    hangingWeight: 352,
    pricePerLb: 8.5,
    totalCost: 2992,
    depositPaid: 500,
    discountAmount: 0,
    discountNote: null,
    balanceDue: 2492,
    payUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
  },
};

// ─── Beef ready for pickup ──────────────────────────────────────────────────
// The admin used to send its own unbranded version of this, quoting a
// hardcoded $8.25/lb when a session had no price. Both senders use this now.
export interface BeefReadyParams {
  firstName: string;
  hangingWeight: number | null;
  pricePerLb: number;
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  pickupUrl: string;
}

export const beefReady: EmailTemplate<BeefReadyParams> = {
  label: 'Beef is ready',
  when: 'When you mark an order ready for pickup.',
  subject: () => 'Your beef is ready for pickup! 🎉',
  preheader: () => 'Cut, vacuum-sealed, labeled, and waiting for you.',
  content: (p) => `
    ${hero('🥩', `Your beef is ready, ${p.firstName}!`, 'Cut, vacuum-sealed, labeled, and waiting for you.')}
    ${para(
      'It&rsquo;s here. Your beef has been cut to your specifications, vacuum-sealed, and labeled. Every package is frozen solid and ready to load into your vehicle. This is the moment you&rsquo;ve been waiting for.'
    )}
    ${orderCard([
      { label: 'Hanging Weight', value: p.hangingWeight ? `${p.hangingWeight} lbs` : 'TBD' },
      { label: 'Price Per Lb', value: `${money(p.pricePerLb)}/lb` },
      { label: 'Total Cost', value: money(p.totalCost) },
      { label: 'Deposit Paid', value: `-${money(p.depositPaid)}` },
      { label: 'Balance Due', value: p.balanceDue > 0 ? money(p.balanceDue) : 'Paid in Full ✓' },
    ])}
    ${whatToBring(p.balanceDue)}
    ${ctaButton('Schedule My Pickup →', p.pickupUrl, '#1A3D2B')}
    ${fineprint(`Questions? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    firstName: 'Sarah',
    hangingWeight: 352,
    pricePerLb: 8.5,
    totalCost: 2992,
    depositPaid: 500,
    balanceDue: 2492,
    pickupUrl: 'https://www.legacylandandcattleco.com/api/token/sample',
  },
};

// ─── Pickup confirmed ───────────────────────────────────────────────────────
export interface PickupConfirmedParams {
  firstName: string;
  dayOfWeek: string;
  pickupDate: string;
  pickupTime: string;
  pickupPerson: string;
  balanceDue: number;
  calendarUrl: string;
}

export const pickupConfirmed: EmailTemplate<PickupConfirmedParams> = {
  label: 'Pickup confirmed',
  when: 'When a customer books their pickup window.',
  subject: (p) => `Pickup confirmed — see you ${p.dayOfWeek}! 🥩`,
  preheader: (p) => `You're on the schedule for ${p.pickupDate}.`,
  content: (p) => `
    ${hero('📅', `Pickup confirmed, ${p.firstName}!`, `We&rsquo;ll see you ${p.dayOfWeek}.`)}
    ${para('You&rsquo;re on the schedule. Here&rsquo;s everything you need for pickup day:')}
    ${orderCard([
      { label: 'Date', value: p.pickupDate },
      { label: 'Time', value: p.pickupTime },
      { label: 'Pickup Person', value: p.pickupPerson },
      { label: 'Address', value: PICKUP_ADDRESS },
    ])}
    ${whatToBring(p.balanceDue)}
    ${ctaButton('Add to Google Calendar 📅', p.calendarUrl, '#1A3D2B')}
    ${fineprint(`Need to change it? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    firstName: 'Sarah',
    dayOfWeek: 'Saturday',
    pickupDate: 'November 8, 2026',
    pickupTime: '10:00 AM',
    pickupPerson: 'Sarah Johnson',
    balanceDue: 0,
    calendarUrl: 'https://calendar.google.com/',
  },
};

// ─── Split partner invite ───────────────────────────────────────────────────
export interface PartnerInviteParams {
  ownerFirstName: string;
  partnerFirstName: string;
  purchaseLabel: string;
  animalName: string;
  butcherDate: string;
  depositAmount: number;
  joinUrl: string;
}

export const partnerInvite: EmailTemplate<PartnerInviteParams> = {
  label: 'Split partner invite',
  when: 'When a customer invites someone to split their beef.',
  subject: (p) => `${p.ownerFirstName} saved you a spot for beef 🐄`,
  preheader: () => 'You&rsquo;ve been invited to split a beef order.',
  content: (p) => `
    ${hero('🥩', `${p.ownerFirstName} wants to split a beef with you.`, 'Your spot is being held for 48 hours.')}
    ${para(
      `Hey ${p.partnerFirstName} — ${p.ownerFirstName} just reserved a ${p.purchaseLabel} from Legacy Land &amp; Cattle here in Colorado Springs and wants you to split it. That means ranch-direct, custom-cut beef in your freezer for months — at a better price than buying solo.`
    )}
    ${orderCard([
      { label: 'Your Share', value: p.purchaseLabel },
      { label: 'Animal', value: p.animalName },
      { label: 'Butcher Date', value: p.butcherDate },
      { label: 'Your Deposit', value: money(p.depositAmount) },
    ])}
    ${para(
      `Your spot is held for <strong>48 hours</strong>. After that it will be released and ${p.ownerFirstName} will need to find another partner or adjust their order.`
    )}
    ${ctaButton('Claim My Spot →', p.joinUrl)}
    ${fineprint(`Questions? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    ownerFirstName: 'Mike',
    partnerFirstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    animalName: 'October 2026 — Grass-Fed',
    butcherDate: 'October 7, 2026',
    depositAmount: 250,
    joinUrl: 'https://www.legacylandandcattleco.com/join/sample',
  },
};

// ─── Split partner has not claimed ──────────────────────────────────────────
export interface PartnerDeadlineParams {
  ownerFirstName: string;
  partnerFirstName: string;
  purchaseLabel: string;
  deadline: string;
  extendUrl: string;
  soloUrl: string;
  newPartnerUrl: string;
}

export const partnerDeadline: EmailTemplate<PartnerDeadlineParams> = {
  label: 'Split partner has not claimed',
  when: 'To the buyer when their invited partner has not paid a deposit before the hold expires.',
  subject: () => "Your partner hasn't claimed their spot yet",
  preheader: () => 'Their hold expires soon — here are your options.',
  content: (p) => `
    ${hero('⏰', `Heads up, ${p.ownerFirstName}.`, `${p.partnerFirstName} hasn&rsquo;t reserved their spot yet.`, 'amber')}
    ${para(
      `You reserved a <strong>${p.purchaseLabel}</strong> and invited ${p.partnerFirstName} to split it with you. They haven&rsquo;t paid their deposit yet — you may want to give them a quick call or text to let them know their spot won&rsquo;t last forever.`
    )}
    ${note('', `⚠️ Their spot expires on <strong>${p.deadline}</strong>`, 'amber')}
    ${para('Here&rsquo;s what you can do:')}
    <table role="presentation" style="width:100%;margin:0 0 12px;">
      <tr><td style="padding:0 0 12px;">
        <a href="${p.extendUrl}" style="display:block;background:#1A3D2B;color:white;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">⏱ Give ${p.partnerFirstName} 24 more hours</a>
      </td></tr>
      <tr><td style="padding:0 0 12px;">
        <a href="${p.soloUrl}" style="display:block;background:#4B5563;color:white;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">🥩 Keep my ${p.purchaseLabel} (solo pricing)</a>
      </td></tr>
      <tr><td>
        <a href="${p.newPartnerUrl}" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;">👥 Invite someone else</a>
      </td></tr>
    </table>
    ${fineprint(`Questions? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    ownerFirstName: 'Mike',
    partnerFirstName: 'Sarah',
    purchaseLabel: 'Whole Beef',
    deadline: 'October 2, 2026 at 10:00 AM',
    extendUrl: '#',
    soloUrl: '#',
    newPartnerUrl: '#',
  },
};

// ─── Abandoned reservation ──────────────────────────────────────────────────
export interface LostCartParams {
  firstName: string;
  purchaseLabel: string;
  paymentUrl: string;
}

export const lostCart: EmailTemplate<LostCartParams> = {
  label: 'Reservation not completed',
  when: 'Automatically overnight, to anyone who started a reservation but never paid the deposit.',
  subject: (p) => `Your spot is being held, ${p.firstName}`,
  preheader: () => 'Complete your deposit to lock it in.',
  content: (p) => `
    ${hero('⏰', `Your spot is being held, ${p.firstName}.`, 'Complete your deposit to lock it in.')}
    ${para(
      `You started a reservation for <strong>${p.purchaseLabel}</strong> but haven&rsquo;t completed your deposit. Your spot is held for 24 hours — after that it will be released.`
    )}
    ${ctaButton('Complete My Deposit →', p.paymentUrl)}
    ${fineprint(`Questions? Call ${PHONE}.`)}
  `,
  sample: {
    firstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    paymentUrl: 'https://www.legacylandandcattleco.com/payment',
  },
};

// ─── Cash / check deposit instructions ──────────────────────────────────────
export interface CashCheckInstructionsParams {
  firstName: string;
  purchaseLabel: string;
  animalName: string;
  butcherDate: string;
  depositAmount: number;
  method: 'cash' | 'check';
  /** True when they somehow finished the cut sheet before paying. */
  cutSheetDone: boolean;
}

export const cashCheckInstructions: EmailTemplate<CashCheckInstructionsParams> = {
  label: 'Cash/check deposit instructions',
  when: 'The moment a customer chooses cash or check for their deposit.',
  subject: (p) => `How to pay your ${money(p.depositAmount)} deposit — Legacy Land & Cattle`,
  preheader: (p) => `Your spot is held. Here&rsquo;s how to get us your ${p.method === 'check' ? 'check' : 'cash'} deposit.`,
  content: (p) => `
    ${hero('🤝', `Your Reservation has been received, ${p.firstName}.`, 'One step left — your deposit.')}
    ${para(
      `We&rsquo;ve set aside your ${p.purchaseLabel.toLowerCase()} and we&rsquo;re holding it for you. Your reservation is confirmed the moment your deposit arrives.`
    )}
    ${orderCard([
      { label: 'Reserved', value: p.purchaseLabel },
      { label: 'Animal', value: p.animalName },
      { label: 'Butcher Date', value: p.butcherDate },
      { label: 'Deposit Due', value: money(p.depositAmount) },
    ])}
    ${note(
      p.method === 'check' ? '✉️ Paying by check' : '💵 Paying with cash',
      p.method === 'check'
        ? `Make your check payable to <strong>Legacy Land &amp; Cattle</strong> for <strong>${money(p.depositAmount)}</strong> and mail it to:<br><br><strong>${PICKUP_ADDRESS}</strong><br><br>Or call us and drop it off — whichever is easier.`
        : `Call us at <strong>${PHONE}</strong> and we&rsquo;ll set a time for you to drop off your <strong>${money(p.depositAmount)}</strong> deposit at the ranch:<br><br><strong>${PICKUP_ADDRESS}</strong>`,
      'green'
    )}
    ${para(
      p.cutSheetDone
        ? 'Your cut sheet is already locked in — once your deposit arrives, you&rsquo;re all set.'
        : 'Once we have it, you&rsquo;ll get a confirmation email and your cut sheet — that&rsquo;s where you tell the butcher exactly how you want your beef cut.'
    )}
    ${fineprint(`Questions? Call us at ${PHONE} or reply to this email.`)}
  `,
  sample: {
    firstName: 'Sarah',
    purchaseLabel: 'Half Beef',
    animalName: 'October 2026 — Grain-Finished',
    butcherDate: 'October 7, 2026',
    depositAmount: 500,
    method: 'check',
    cutSheetDone: false,
  },
};

// ─── Returning customer sign-in link ────────────────────────────────────────
export interface ReturningLinkParams {
  firstName: string;
  mostRecentOrder: string | null;
  orderUrl: string;
}

export const returningLink: EmailTemplate<ReturningLinkParams> = {
  label: 'Returning customer link',
  when: 'When someone asks for their order link from the Returning Customer page.',
  subject: () => 'Your Legacy Land & Cattle order',
  preheader: () => 'Here is your way back into your account.',
  content: (p) => `
    ${para(
      `Hi ${p.firstName} — here&rsquo;s your way back in. This link opens your account, where you can see every order you have placed, your cut sheets, your invoices and your payments — and reserve your next beef in about a minute.`
    )}
    ${ctaButton('Open my account →', p.orderUrl)}
    ${p.mostRecentOrder
      ? `<p style="color:#6B7280;font-family:Arial,sans-serif;font-size:13px;text-align:center;margin-top:8px;">Most recent order: ${p.mostRecentOrder}</p>`
      : ''}
    ${fineprint(`If you didn&rsquo;t ask for this, you can ignore it. Questions? Call ${PHONE}.`)}
  `,
  sample: {
    firstName: 'Sarah',
    mostRecentOrder: 'October 2026 — Grass-Fed',
    orderUrl: 'https://www.legacylandandcattleco.com/api/token/sample?to=account',
  },
};

// ─── Registry, for the admin preview ────────────────────────────────────────
/**
 * Every customer-facing email, keyed by the id the preview uses. Adding a
 * template here is all it takes for it to show up in the admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EMAIL_TEMPLATES: Record<string, EmailTemplate<any>> = {
  deposit_confirmation: depositConfirmation,
  cut_sheet_invite: cutSheetInvite,
  reminder_10day: reminder10Day,
  reminder_last_call: reminderLastCall,
  auto_locked: autoLocked,
  cut_sheet_locked: cutSheetLocked,
  cut_sheet_locked_partner: cutSheetLockedPartner,
  hanging_weight: hangingWeight,
  beef_ready: beefReady,
  pickup_confirmed: pickupConfirmed,
  partner_invite: partnerInvite,
  partner_deadline: partnerDeadline,
  cash_check_instructions: cashCheckInstructions,
  lost_cart: lostCart,
  returning_link: returningLink,
};

/** Renders a template with its sample data, for the admin preview. */
export function previewEmail(id: string): (BuiltEmail & { label: string; when: string }) | null {
  const t = EMAIL_TEMPLATES[id];
  if (!t) return null;
  return { ...build(t, t.sample), label: t.label, when: t.when };
}
