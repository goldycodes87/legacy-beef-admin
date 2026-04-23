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

interface HangingWeightEmailParams {
  firstName: string;
  purchaseLabel: string;
  hangingWeight: number;
  pricePerLb: number;
  totalCost: number;
  depositPaid: number;
  balanceDue: number;
  payLink: string;
}

function buildHangingWeightEmail(p: HangingWeightEmailParams): string {
  const COLORS = {
    GREEN: '#1A3D2B',
    ORANGE: '#E85D24',
    DARK: '#0F0F0F',
    GOLD: '#C4A46B',
  };

  const orderRows = [
    { label: 'Order', value: p.purchaseLabel },
    { label: 'Hanging Weight', value: `${p.hangingWeight} lbs` },
    { label: 'Price Per Lb', value: `$${p.pricePerLb.toFixed(2)}/lb` },
    { label: 'Total Cost', value: `$${p.totalCost.toFixed(2)}` },
    { label: 'Deposit Paid', value: `-$${p.depositPaid.toFixed(2)}` },
    { label: 'Balance Due', value: `$${p.balanceDue.toFixed(2)}`, highlight: true },
  ];

  const rows = orderRows
    .map(
      (r) => `
    <tr>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;font-size:13px;color:#666;font-family:Arial,sans-serif;width:45%;">
        ${r.label}
      </td>
      <td style="padding:12px 20px;border-bottom:1px solid #E5E0D8;font-size:13px;font-weight:${r.highlight ? 'bold' : 'normal'};color:${r.highlight ? COLORS.ORANGE : COLORS.DARK};font-family:Arial,sans-serif;">
        ${r.value}
      </td>
    </tr>
    `
    )
    .join('');

  return `<div style="background:linear-gradient(135deg,${COLORS.GREEN} 0%,#2d6a4f 100%);border-radius:12px;padding:28px 24px;text-align:center;margin:0 0 28px;">
    <div style="font-size:40px;margin-bottom:8px;">⚖️</div>
    <h2 style="font-family:Georgia,serif;color:white;font-size:24px;margin:0 0 8px;font-weight:normal;">
      Your hanging weight is in, ${p.firstName}.
    </h2>
    <p style="color:${COLORS.GOLD};font-size:14px;margin:0;font-family:Arial,sans-serif;">
      Here's your final balance.
    </p>
  </div>
  <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
    Your beef has been harvested and weighed. This is the final hanging weight — the number your balance is calculated from. Everything looks great.
  </p>
  <table role="presentation" style="width:100%;background:#F9F6F1;border-radius:12px;border:1px solid #E5E0D8;margin:0 0 24px;">
    ${rows}
  </table>
  <p style="color:#374151;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 24px;">
    You can pay your balance now online, or bring payment when you pick up your beef — cash, check, or card all work.
  </p>
  <table role="presentation" style="width:100%;margin:0 0 12px;">
    <tr><td style="padding:0 0 12px;">
      <a href="${p.payLink}" style="display:block;background:${COLORS.ORANGE};color:white;text-align:center;padding:16px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">
        Pay My Balance Now →
      </a>
    </td></tr>
    <tr><td>
      <a href="${p.payLink}" style="display:block;background:#F5F0E8;color:${COLORS.GREEN};text-align:center;padding:16px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border:2px solid ${COLORS.GREEN};">
        I'll Pay at Pickup
      </a>
    </td></tr>
  </table>
  <p style="color:#9CA3AF;font-size:12px;font-family:Arial,sans-serif;text-align:center;margin-top:16px;">
    Questions? Call us at (719) 258-1777 or reply to this email.
  </p>`;
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
    <h2 style="font-family:Georgia,serif;color:#E85D24;margin:0 0 8px;">
      Your split partner hasn't paid yet.
    </h2>
    <p>You reserved a whole beef and invited a split partner. They have 24 hours remaining to pay their deposit or their spot will be released.</p>
    ${orderCard([
      { label: 'Butcher Date', value: MOCK.butcherDate },
      { label: 'Deadline', value: 'In 24 hours' },
    ])}
    <p style="font-size:13px;color:#666;">
      If they don't pay in time, you can find a new partner or convert to a half beef reservation.
    </p>
  `;
  return buildEmailHtml(content, 'Your split partner hasn\'t paid yet — 24 hours left.');
}

function reminder10Day(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#1A3D2B;margin:0 0 8px;">
      Your cut sheet is due in 10 days.
    </h2>
    <p>Your butcher date is coming up. Make sure your cut sheet is complete before May 5, 2026 so we can get it to T-K Processing on time.</p>
    ${ctaButton('Complete My Cut Sheet', MOCK.cutSheetUrl)}
  `;
  return buildEmailHtml(content, '10 days until your cut sheet is due.');
}

function reminder1Day(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#E85D24;margin:0 0 8px;">
      Your cut sheet is due tomorrow.
    </h2>
    <p>This is your final reminder. Your cut sheet must be submitted by end of day tomorrow. After that it will be locked with our house defaults.</p>
    ${ctaButton('Complete My Cut Sheet Now', MOCK.cutSheetUrl)}
  `;
  return buildEmailHtml(content, 'Last chance — cut sheet due tomorrow.');
}

function cutSheetLocked(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#1A3D2B;margin:0 0 8px;">
      Your cut sheet is locked and on its way.
    </h2>
    <p>We've received your cut sheet and it's been submitted to T-K Processing in Cañon City. Your beef will be cut exactly to your specifications.</p>
    ${orderCard([
      { label: 'Butcher Date', value: MOCK.butcherDate },
      { label: 'Estimated Pickup', value: 'May 30 - June 7, 2026' },
      { label: 'Hanging Weight', value: MOCK.hangingWeight },
    ])}
    <p>We'll be in touch when your beef is ready for pickup.</p>
  `;
  return buildEmailHtml(content, 'Your cut sheet has been submitted to the butcher.');
}

function autoLock(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#E85D24;margin:0 0 8px;">
      Your cut sheet has been locked.
    </h2>
    <p>Your cut sheet deadline passed without a submission, so we've locked it with our Legacy House Cut — a well-rounded selection that works great for most families.</p>
    <p>If you have questions about your cuts, contact us before the butcher date.</p>
  `;
  return buildEmailHtml(content, 'Your cut sheet has been locked with house defaults.');
}

function beefReady(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#1A3D2B;margin:0 0 8px;">
      Your beef is ready, ${MOCK.customerName}.
    </h2>
    <p>Your beef has been cut, vacuum-sealed, and labeled. It's waiting for you at the ranch.</p>
    ${orderCard([
      { label: 'Hanging Weight', value: MOCK.hangingWeight },
      { label: 'Price Per Lb', value: MOCK.pricePerLb },
      { label: 'Balance Due', value: MOCK.balanceDue },
      { label: 'Pickup Location', value: 'El Paso County, CO' },
    ])}
    <p>Schedule your pickup using the link below. You can pay your remaining balance online or at pickup — cash, check, or card accepted.</p>
    ${ctaButton('Schedule My Pickup', MOCK.accessUrl)}
  `;
  return buildEmailHtml(content, 'Your beef is ready — time to schedule pickup.');
}

function pickupConfirmed(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#1A3D2B;margin:0 0 8px;">
      Pickup confirmed.
    </h2>
    <p>You're all set. Here are your pickup details:</p>
    ${orderCard([
      { label: 'Date & Time', value: MOCK.pickupDate },
      { label: 'Location', value: 'Legacy Land & Cattle' },
      { label: 'Address', value: '6105 Burgess Rd, Colorado Springs, CO 80908' },
      { label: 'Balance Due', value: MOCK.balanceDue },
    ])}
    <p>Bring a cooler or we can help you load straight into your vehicle. See you then.</p>
  `;
  return buildEmailHtml(content, 'Pickup confirmed — see you then.');
}

function balancePayment(): string {
  const content = `
    <h2 style="font-family:Georgia,serif;color:#1A3D2B;margin:0 0 8px;">
      Payment received. Thank you.
    </h2>
    <p>Your balance payment has been received. Here's your final receipt:</p>
    ${orderCard([
      { label: 'Size', value: MOCK.purchaseType === 'half' ? 'Half Beef' : 'Whole Beef' },
      { label: 'Hanging Weight', value: MOCK.hangingWeight },
      { label: 'Price Per Lb', value: MOCK.pricePerLb },
      { label: 'Deposit Paid', value: MOCK.depositAmount },
      { label: 'Balance Paid', value: MOCK.balanceDue },
      { label: 'Total Paid', value: MOCK.totalEstimate },
    ])}
    <p>See you at pickup.</p>
  `;
  return buildEmailHtml(content, 'Balance payment received — you\'re all set.');
}

function hangingWeight(): string {
  const content = buildHangingWeightEmail({
    firstName: 'Mike',
    purchaseLabel: 'Half Beef',
    hangingWeight: 238,
    pricePerLb: 8.25,
    totalCost: 1963.50,
    depositPaid: 500,
    balanceDue: 1463.50,
    payLink: MOCK.accessUrl,
  });
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
