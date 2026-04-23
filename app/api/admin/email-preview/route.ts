export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const MOCK = {
  customerName: 'Sarah Johnson',
  purchaseType: 'half',
  animalType: 'grass_fed',
  butcherDate: 'May 15, 2026',
  depositAmount: '$500.00',
  balanceDue: '$1,850.00',
  totalEstimate: '$2,350.00',
  sessionId: 'preview-session-id',
  accessUrl: 'https://www.legacylandandcattleco.com/access/preview',
  cutSheetUrl: 'https://www.legacylandandcattleco.com/session/preview/cuts',
  pickupDate: 'June 7, 2026 at 10:00 AM',
  hangingWeight: '238 lbs',
  pricePerLb: '$8.25',
  phone: '(719) 258-1777',
  email: 'orders@legacylandandcattleco.com',
};

function buildEmailHtml(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legacy Land & Cattle</title>
</head>
<body style="background-color:#F5F0E8;margin:0;padding:20px;font-family:Arial,sans-serif;">
  ${preheader ? `<div style="font-size:0;color:#ffffff;display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;">
    <tr>
      <td style="padding:20px;">
        <table role="presentation" style="width:100%;background:white;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1A3D2B;padding:40px 20px;text-align:center;">
              <img src="https://www.legacylandandcattleco.com/images/LLC_Logo_white.svg" 
                alt="Legacy Land & Cattle" width="160" 
                style="width:160px;height:auto;display:block;margin:0 auto 16px;" />
              <p style="color:#C4A46B;font-size:12px;margin:0;
                font-family:Arial,sans-serif;letter-spacing:1px;">
                Ranch Direct · Colorado Springs, CO
              </p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;color:#0F0F0F;font-family:Arial,sans-serif;
              font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F9F6F1;padding:30px 20px;
              text-align:center;border-top:1px solid #E5E0D8;">
              <p style="font-size:12px;color:#666;margin:0 0 8px;
                font-family:Arial,sans-serif;">
                <strong>Legacy Land & Cattle</strong><br>
                Colorado Springs, CO
              </p>
              <p style="font-size:12px;color:#666;margin:0;
                font-family:Arial,sans-serif;">
                <a href="mailto:orders@legacylandandcattleco.com" 
                  style="color:#E85D24;text-decoration:none;">
                  orders@legacylandandcattleco.com
                </a><br>
                <a href="tel:+17192581777" 
                  style="color:#E85D24;text-decoration:none;">
                  (719) 258-1777
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" style="margin:24px auto;">
    <tr>
      <td style="background-color:#E85D24;border-radius:10px;
        text-align:center;padding:0;">
        <a href="${url}" style="display:inline-block;padding:16px 36px;
          color:white;font-family:Arial,sans-serif;font-size:16px;
          font-weight:bold;text-decoration:none;border-radius:10px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function orderCard(fields: { label: string; value: string }[]): string {
  return `<table role="presentation" style="width:100%;
    background:#F9F6F1;border-radius:12px;
    border:1px solid #E5E0D8;margin:20px 0;">
    ${fields
      .map(
        (f) => `
    <tr>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;
        font-size:13px;color:#666;font-family:Arial,sans-serif;
        width:40%;">${f.label}</td>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;
        font-size:13px;font-weight:bold;color:#0F0F0F;
        font-family:Arial,sans-serif;">${f.value}</td>
    </tr>
    `
      )
      .join('')}
  </table>`;
}



function depositConfirmation(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">🎉</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:26px;margin:0 0 8px;font-weight:normal;">
        You're in, ${MOCK.customerName.split(' ')[0]}.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Your spot is locked. Your beef is coming.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We've got your deposit and your reservation is officially on the books. This is real, ranch-direct beef raised right here in Colorado Springs — no grocery store, no middleman. Just our cattle, our butcher, and your freezer.
    </p>
    ${orderCard([
      { label: 'Order Type', value: 'Half Beef' },
      { label: 'Animal', value: 'May 2026 — Grass-Fed' },
      { label: 'Butcher Date', value: MOCK.butcherDate },
      { label: 'Est. Ready', value: 'June 7, 2026' },
      { label: 'Price/lb', value: MOCK.pricePerLb },
      { label: 'Deposit Paid', value: MOCK.depositAmount },
    ])}
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 16px;">
      <strong style="color:#1A3D2B;">Your next step:</strong> Fill out your cut sheet — that's where you tell the butcher exactly how you want your beef cut. Steak thickness, roast size, ground beef ratio, all of it.
    </p>
    ${ctaButton('Build My Cut Sheet →', MOCK.cutSheetUrl)}
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:8px;">
      This link is yours — bookmark it for easy access anytime.
    </p>
  `;
  return buildEmailHtml(content, 'Your spot is locked. Your beef is coming.');
}

function partnerInvite(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">🥩</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:26px;margin:0 0 8px;font-weight:normal;">
        Mike wants to split a beef with you.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Your spot is being held for 48 hours.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Hey Sarah — Mike just reserved a Half Beef from Legacy Land & Cattle here in Colorado Springs and wants you to split it. That means ranch-direct, custom-cut beef in your freezer for months — at a better price than buying solo.
    </p>
    ${orderCard([
      { label: 'Your Share', value: 'Half Beef' },
      { label: 'Animal Type', value: 'Grass-Fed Beef' },
      { label: 'Butcher Date', value: MOCK.butcherDate },
      { label: 'Your Deposit', value: '$250.00' },
    ])}
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:24px 0 16px;">
      Your spot is held for <strong>48 hours</strong>. After that it will be released and Mike will need to find another partner or adjust their order.
    </p>
    ${ctaButton('Claim My Spot →', MOCK.accessUrl)}
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Questions? Call us at (719) 258-1777 or reply to this email.
    </p>
  `;
  return buildEmailHtml(content, 'You\'ve been invited to split a beef order.');
}

function partnerDeadline(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">⏰</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Heads up, Sarah.
      </h2>
      <p style="color:#fde68a;font-size:14px;margin:0;font-family:Arial,sans-serif;">
        Mike hasn't reserved their spot yet.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 20px;">
      You reserved a Whole Beef and invited Mike to split it with you. They haven't paid their deposit yet — you may want to give them a quick call or text to let them know their spot won't last forever.
    </p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin:0 0 24px;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#92400e;margin:0;">
        ⚠️ Their spot expires on <strong>May 6, 2026 at 10:00 AM</strong>
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Here's what you can do:
    </p>
    <table role="presentation" style="width:100%;margin:0 0 12px;">
      <tr><td style="padding:0 0 12px;">
        <a href="#" style="display:block;background:#1A3D2B;color:white;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">
          ⏱ Give Mike 24 more hours
        </a>
      </td></tr>
      <tr><td style="padding:0 0 12px;">
        <a href="#" style="display:block;background:#4B5563;color:white;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">
          🥩 Keep my Whole Beef (solo pricing)
        </a>
      </td></tr>
      <tr><td style="padding:0 0 12px;">
        <a href="#" style="display:block;background:#6B7280;color:white;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;">
          📦 Downsize to a Half Beef
        </a>
      </td></tr>
      <tr><td>
        <a href="#" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;">
          👤 Invite a different partner
        </a>
      </td></tr>
    </table>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:16px;">
      Questions? Call us at (719) 258-1777 or reply to this email.
    </p>
  `;
  return buildEmailHtml(content, 'Mike hasn\'t claimed their spot yet.');
}

function reminder10Day(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">✂️</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Time to build your cut sheet, Sarah.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Butcher date: May 15, 2026
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We know life gets busy — but this is the fun part. Tell us exactly how you want your beef cut: steaks, roasts, ground beef, stew meat, bones for broth. It's all yours.
    </p>
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
        🏠 Not sure what to pick?
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;">
        Choose our Legacy House Cut — a chef-approved selection that maximizes your beef and puts variety in your freezer.
      </p>
    </div>
    ${ctaButton('Build My Cut Sheet →', MOCK.cutSheetUrl)}
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Questions? Call us at (719) 258-1777 or reply to this email.
    </p>
  `;
  return buildEmailHtml(content, 'Time to build your cut sheet.');
}

function reminder1Day(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">⏰</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Last call, Sarah.
      </h2>
      <p style="color:#fde68a;font-size:14px;margin:0;font-family:Arial,sans-serif;">
        Your cut sheet locks tomorrow.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Tomorrow we hand your cut sheet to T-K Processing in Cañon City. After that, any changes become complicated (and expensive). Make sure you're happy with your selections.
    </p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin:0 0 24px;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#92400e;margin:0;">
        ⚠️ After tomorrow your cut sheet is locked
      </p>
    </div>
    ${ctaButton('Complete My Cut Sheet Now →', MOCK.cutSheetUrl)}
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Happy with your defaults? No action needed — we'll lock everything tomorrow at 10 AM.
    </p>
  `;
  return buildEmailHtml(content, 'Last chance to update your cut sheet.');
}

function cutSheetLocked(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">✅</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Your cut sheet is done, Sarah.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        We've got your cutting instructions.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      You just made the most important decision of this whole process — and we've got every detail. Your cut sheet is locked and will be hand-delivered to T-K Processing in Cañon City before your butcher date.
    </p>
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
        📅 What happens next
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;line-height:1.8;">
        1. We take your cut sheet to T-K Processing<br>
        2. Your beef is dry-aged 21–24 days<br>
        3. Cut, vacuum-sealed, and labeled to your specs<br>
        4. We'll email you when it's ready for pickup
      </p>
    </div>
    <a href="${MOCK.accessUrl}" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;margin:24px 0 8px;">
      Review My Cut Sheet →
    </a>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Questions before May 15, 2026? Reply to this email and we'll do our best to accommodate.
    </p>
  `;
  return buildEmailHtml(content, 'Your cut sheet is locked.');
}

function autoLock(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">🏠</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        We've got you covered, Sarah.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Your cut sheet is locked and on its way.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Life gets busy — we get it. Since you didn't build a custom cut sheet, we've locked in our Legacy House Cut for your beef. It's chef-approved and maximizes your variety.
    </p>
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
        🥩 What's in the Legacy House Cut?
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;line-height:1.8;">
        Prime steaks (T-bone, NY strip), roasts, ground beef, stew meat, and bones for broth. You'll love it.
      </p>
    </div>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Have a special request before May 15, 2026? Reply to this email and we'll do our best to accommodate.
    </p>
  `;
  return buildEmailHtml(content, 'Your cut sheet is locked with Legacy House Cut.');
}

function beefReady(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">🥩</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Your beef is ready, Sarah!
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Cut, vacuum-sealed, labeled, and waiting for you.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      It's here. Your beef has been cut to your specifications and is sitting in our freezer, ready for pickup. We're excited for you to get it home and get cooking.
    </p>
    ${orderCard([
      { label: 'Hanging Weight', value: MOCK.hangingWeight },
      { label: 'Price Per Lb', value: MOCK.pricePerLb },
      { label: 'Total Cost', value: '$1,963.50' },
      { label: 'Deposit Paid', value: '-$500.00' },
      { label: 'Balance Due', value: '$1,463.50' },
    ])}
    <div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:12px;padding:16px 20px;margin:24px 0;text-align:center;">
      <p style="color:#E65100;font-family:Arial,sans-serif;font-size:13px;margin:0 0 12px;font-weight:bold;">
        💳 Still owe $1,463.50
      </p>
      <table role="presentation" style="width:100%;margin:0;">
        <tr><td style="padding:0 0 8px;">
          <a href="${MOCK.accessUrl}" style="display:block;background:#E85D24;color:white;text-align:center;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">
            Pay Now
          </a>
        </td></tr>
        <tr><td>
          <a href="${MOCK.accessUrl}" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;">
            Pay at Pickup
          </a>
        </td></tr>
      </table>
    </div>
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:24px 0;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
        📦 What to bring
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;line-height:1.8;">
        • Coolers or boxes (we'll help load)<br>
        • Balance payment if not paid online<br>
        • A big appetite! 🍖
      </p>
    </div>
    ${ctaButton('Schedule My Pickup →', MOCK.accessUrl)}
  `;
  return buildEmailHtml(content, 'Your beef is ready for pickup!');
}

function pickupConfirmed(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">📅</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Pickup confirmed, Sarah!
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        We'll see you Saturday.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      You're on the schedule. Here are your pickup details — save this email or add it to your calendar.
    </p>
    ${orderCard([
      { label: 'Date', value: 'June 7, 2026' },
      { label: 'Time', value: '10:00 AM – 11:00 AM' },
      { label: 'Pickup Person', value: 'Sarah (You)' },
      { label: 'Address', value: '6105 Burgess Rd, Colorado Springs, CO 80908' },
    ])}
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:24px 0;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0 0 8px;font-weight:bold;">
        📦 What to bring
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#374151;margin:0;line-height:1.8;">
        • Coolers or boxes (we'll help load)<br>
        • Balance payment if not paid online<br>
        • A big appetite! 🍖
      </p>
    </div>
    ${ctaButton('Add to Google Calendar 📅', 'https://www.google.com/calendar')}
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Need to reschedule? Call us at (719) 258-1777.
    </p>
  `;
  return buildEmailHtml(content, 'Your pickup is confirmed!');
}

function balancePayment(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">💳</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        You're all paid up, Sarah.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Balance paid in full. Nothing left to do but show up.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Your balance payment has been received and processed. All payments are complete. You're all set for pickup.
    </p>
    ${orderCard([
      { label: 'Amount Paid', value: '$1,463.50' },
      { label: 'Date', value: 'Today' },
      { label: 'Payment Method', value: 'Credit Card' },
      { label: 'Balance Status', value: 'Paid in Full' },
    ])}
    <div style="background:#E8F5E9;border:1px solid #4CAF50;border-radius:12px;padding:16px 20px;margin:24px 0;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#1A3D2B;margin:0;font-weight:bold;">
        ✅ All done. Just show up for pickup.
      </p>
    </div>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Questions? Call us at (719) 258-1777.
    </p>
  `;
  return buildEmailHtml(content, 'Your balance payment is complete.');
}

function hangingWeight(): string {
  const content = `
    <div style="background:linear-gradient(135deg,#1A3D2B 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
      <div style="font-size:40px;margin-bottom:8px;">⚖️</div>
      <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
        Your hanging weight is in, Sarah.
      </h2>
      <p style="color:#C4A46B;font-size:14px;margin:0;font-family:Arial,sans-serif;letter-spacing:0.5px;">
        Here's your final balance.
      </p>
    </div>
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Your beef has been harvested and weighed. This is the final hanging weight — the number your balance is calculated from. Everything looks great.
    </p>
    ${orderCard([
      { label: 'Order', value: 'Half Beef' },
      { label: 'Hanging Weight', value: '238 lbs' },
      { label: 'Price Per Lb', value: '$8.25/lb' },
      { label: 'Total Cost', value: '$1,963.50' },
      { label: 'Deposit Paid', value: '-$500.00' },
      { label: 'Balance Due', value: '$1,463.50' },
    ])}
    <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:24px 0 16px;">
      You can pay your balance now online, or bring payment when you pick up your beef — cash, check, or card all work.
    </p>
    ${ctaButton('Pay My Balance Now →', MOCK.accessUrl)}
    <a href="${MOCK.accessUrl}" style="display:block;background:#F5F0E8;color:#1A3D2B;text-align:center;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid #1A3D2B;margin:12px 0 8px;">
      I'll Pay at Pickup
    </a>
    <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;">
      Questions? Call us at (719) 258-1777 or reply to this email.
    </p>
  `;
  return buildEmailHtml(content, 'Your hanging weight is in — here\'s your balance');
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'deposit_confirmation';

  let html = '';
  switch (type) {
    case 'deposit_confirmation':
      html = depositConfirmation();
      break;
    case 'partner_invite':
      html = partnerInvite();
      break;
    case 'partner_deadline':
      html = partnerDeadline();
      break;
    case 'reminder_10day':
      html = reminder10Day();
      break;
    case 'reminder_1day':
      html = reminder1Day();
      break;
    case 'cut_sheet_locked':
      html = cutSheetLocked();
      break;
    case 'auto_lock':
      html = autoLock();
      break;
    case 'beef_ready':
      html = beefReady();
      break;
    case 'pickup_confirmed':
      html = pickupConfirmed();
      break;
    case 'balance_payment':
      html = balancePayment();
      break;
    case 'hanging_weight':
      html = hangingWeight();
      break;
    default:
      html = depositConfirmation();
  }

  return NextResponse.json({ html });
}
