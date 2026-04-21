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

function emailWrapper(contentHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #2C1810; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .body { padding: 32px 24px; color: #333; line-height: 1.6; }
    .body h2 { color: #2C1810; font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
    .body p { margin: 12px 0; }
    .section { margin: 24px 0; padding: 16px; background: #f9f9f9; border-radius: 6px; }
    .label { font-weight: 600; color: #2C1810; display: inline-block; min-width: 150px; }
    .value { color: #555; }
    .button { display: inline-block; padding: 12px 24px; background: #E85D24; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .button:hover { background: #d64c1f; }
    .footer { background: #f9f9f9; padding: 24px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Legacy Land & Cattle</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Premium Grass-Fed & Grass-Finished Beef</p>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Legacy Land & Cattle LLC | El Paso County, Colorado</p>
      <p>Phone: ${MOCK.phone} | Email: ${MOCK.email}</p>
      <p style="margin-top: 16px; opacity: 0.7;">© 2026 Legacy Land & Cattle. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function depositConfirmation(): string {
  return emailWrapper(`
    <h2>Deposit Received ✓</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Thank you! We've received your deposit of <strong>${MOCK.depositAmount}</strong> for your ${MOCK.purchaseType} beef order.</p>
    <div class="section">
      <div><span class="label">Order Type:</span><span class="value">${MOCK.purchaseType === 'half' ? 'Half Beef' : 'Whole Beef'}</span></div>
      <div><span class="label">Animal Type:</span><span class="value">Grass-Fed Beef</span></div>
      <div><span class="label">Butcher Date:</span><span class="value">${MOCK.butcherDate}</span></div>
      <div><span class="label">Estimated Total:</span><span class="value">${MOCK.totalEstimate}</span></div>
    </div>
    <p>Your session is ready. Log in to customize your cut sheet and track your order.</p>
    <a href="${MOCK.accessUrl}" class="button">Access Your Order</a>
    <p>Questions? Reply to this email or call us at ${MOCK.phone}.</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function partnerInvite(): string {
  return emailWrapper(`
    <h2>Split Your Order & Save</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>You're invited to partner with another customer to split a beef order and save on costs.</p>
    <div class="section">
      <p><strong>Here's how it works:</strong></p>
      <ul>
        <li>You and your partner split one beef animal</li>
        <li>Each customize your half independently</li>
        <li>Save money with bulk pricing</li>
      </ul>
    </div>
    <p>Interest someone in splitting? Share this link:</p>
    <a href="${MOCK.accessUrl}" class="button">View Partnership Details</a>
    <p>Partnership deadline: May 1, 2026. Confirm your partner by then to lock in pricing.</p>
    <p>Questions? Let us know!</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function partnerDeadline(): string {
  return emailWrapper(`
    <h2>⏰ Partnership Deadline Approaching</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>You have a pending partnership request that expires in <strong>3 days</strong>.</p>
    <div class="section">
      <p>If you want to split with a partner, confirm by <strong>April 28, 2026</strong>.</p>
      <p>If no partner is confirmed by then, your order will proceed as a solo ${MOCK.purchaseType} beef.</p>
    </div>
    <a href="${MOCK.accessUrl}" class="button">Review Partnership</a>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function reminder10Day(): string {
  return emailWrapper(`
    <h2>📋 Cut Sheet Customization Reminder</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>You have <strong>10 days</strong> to customize your cut sheet before it auto-locks.</p>
    <div class="section">
      <p>Review and customize:</p>
      <ul>
        <li>Chuck, brisket, ribs, short loin options</li>
        <li>Ground beef vs. steaks preferences</li>
        <li>Special requests (thickness, packing, etc.)</li>
      </ul>
    </div>
    <a href="${MOCK.cutSheetUrl}" class="button">Customize Your Cuts</a>
    <p>No changes after the deadline. Make your selections count!</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function reminder1Day(): string {
  return emailWrapper(`
    <h2>⚠️ Last Chance: Cut Sheet Customization</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Your cut sheet customization closes <strong>tomorrow at midnight</strong>.</p>
    <div class="section">
      <p>After that, your order locks in and we move to butchering.</p>
    </div>
    <a href="${MOCK.cutSheetUrl}" class="button">Finalize Your Cuts Now</a>
    <p>Any questions? Call us: ${MOCK.phone}</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function cutSheetLocked(): string {
  return emailWrapper(`
    <h2>✓ Your Cut Sheet is Locked</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Your cut sheet customization has closed. Your preferences are finalized and we're ready to butcher.</p>
    <div class="section">
      <div><span class="label">Hanging Weight:</span><span class="value">${MOCK.hangingWeight}</span></div>
      <div><span class="label">Price per Lb:</span><span class="value">${MOCK.pricePerLb}</span></div>
      <div><span class="label">Estimated Balance:</span><span class="value">${MOCK.balanceDue}</span></div>
    </div>
    <p>Butchering begins on ${MOCK.butcherDate}. We'll update you when your beef is ready for pickup.</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function autoLockNotice(): string {
  return emailWrapper(`
    <h2>🔒 Cut Sheet Auto-Locked</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Your cut sheet customization deadline has passed. Your order has been auto-locked with default preferences.</p>
    <div class="section">
      <p>Your beef will be processed with:</p>
      <ul>
        <li>Standard thickness cuts</li>
        <li>Ground beef: 80/20 blend</li>
        <li>Standard packing</li>
      </ul>
    </div>
    <p>Want to make changes? Contact us ASAP: ${MOCK.phone}</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function beefReady(): string {
  return emailWrapper(`
    <h2>🥩 Your Beef is Ready!</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Great news! Your beef has been butchered and is ready for pickup.</p>
    <div class="section">
      <div><span class="label">Pickup Date:</span><span class="value">${MOCK.pickupDate}</span></div>
      <div><span class="label">Location:</span><span class="value">Legacy Land & Cattle, El Paso County, CO</span></div>
      <div><span class="label">Balance Due:</span><span class="value">${MOCK.balanceDue}</span></div>
    </div>
    <a href="${MOCK.accessUrl}" class="button">Schedule Your Pickup</a>
    <p>Please bring a cooler. We'll have your beef ready and packaged for you.</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function pickupConfirmed(): string {
  return emailWrapper(`
    <h2>✓ Pickup Confirmed</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Your pickup is confirmed for <strong>${MOCK.pickupDate}</strong>.</p>
    <div class="section">
      <p>We have your ${MOCK.purchaseType} beef ready to go. Bring a cooler and we'll handle the rest.</p>
    </div>
    <p>See you soon!</p>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
}

function balancePayment(): string {
  return emailWrapper(`
    <h2>💰 Balance Payment Received</h2>
    <p>Hi ${MOCK.customerName},</p>
    <p>Thank you! We've received your balance payment of <strong>${MOCK.balanceDue}</strong>.</p>
    <div class="section">
      <div><span class="label">Deposit:</span><span class="value">${MOCK.depositAmount}</span></div>
      <div><span class="label">Balance:</span><span class="value">${MOCK.balanceDue}</span></div>
      <div><span class="label">Total Paid:</span><span class="value">${MOCK.totalEstimate}</span></div>
    </div>
    <p>You're all set! Your order is complete. We'll confirm your pickup date shortly.</p>
    <a href="${MOCK.accessUrl}" class="button">View Your Order</a>
    <p>—<br>The Team at Legacy Land & Cattle</p>
  `);
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
      html = autoLockNotice();
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
    default:
      html = depositConfirmation();
  }

  return NextResponse.json({ html });
}
