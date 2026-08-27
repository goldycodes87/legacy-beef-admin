/**
 * Deep links into the Square Point of Sale app.
 *
 * A bare `square-commerce-v1://` anchor did nothing when tapped — POS only
 * registers the payment/create route, and desktop browsers have nowhere to
 * send a custom scheme at all. These helpers build the real Point of Sale API
 * links, which open the app with the amount already keyed in.
 *
 * Requirements, one-time, in the Square Developer dashboard for the same
 * application the portal charges through:
 *   - NEXT_PUBLIC_SQUARE_APP_ID set in this project's Vercel env (same value
 *     as the portal's).
 *   - The callback URL below added under Point of Sale API → Web callback URLs.
 * Without those, openSquarePos() falls back to launching the app with nothing
 * prefilled.
 */

const CALLBACK_URL = 'https://admin.legacylandandcattleco.com/pos-callback';

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/** What we tell Square to hand back so the callback can record the payment. */
export interface PosState {
  sessionId: string;
  amountCents: number;
}

/** iOS Point of Sale API link with the amount prefilled. */
function iosChargeUrl(amountCents: number, note: string, state?: PosState): string | null {
  const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  if (!clientId) return null;
  const data = {
    amount_money: { amount: amountCents, currency_code: 'USD' },
    callback_url: CALLBACK_URL,
    client_id: clientId,
    version: '1.3',
    notes: note.slice(0, 500),
    // Square returns this untouched in the callback.
    ...(state ? { state: JSON.stringify(state) } : {}),
    options: {
      supported_tender_types: ['CREDIT_CARD', 'CASH', 'OTHER', 'SQUARE_GIFT_CARD', 'CARD_ON_FILE'],
    },
  };
  return 'square-commerce-v1://payment/create?data=' + encodeURIComponent(JSON.stringify(data));
}

/** Android intent link with the amount prefilled. */
function androidChargeUrl(amountCents: number, note: string, state?: PosState): string | null {
  const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  if (!clientId) return null;
  const params = [
    'S.com.google.android.apps.chrome.EXTRA_APPLICATION_ID=' + encodeURIComponent(clientId),
    'S.browser_fallback_url=' + encodeURIComponent(CALLBACK_URL),
    'S.com.squareup.pos.WEB_CALLBACK_URI=' + encodeURIComponent(CALLBACK_URL),
    'S.com.squareup.pos.CLIENT_ID=' + encodeURIComponent(clientId),
    'S.com.squareup.pos.API_VERSION=v2.0',
    'i.com.squareup.pos.TOTAL_AMOUNT=' + amountCents,
    'S.com.squareup.pos.CURRENCY_CODE=USD',
    'S.com.squareup.pos.TENDER_TYPES=' +
      encodeURIComponent(
        'com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CARD_ON_FILE,com.squareup.pos.TENDER_CASH,com.squareup.pos.TENDER_OTHER'
      ),
    'S.com.squareup.pos.NOTE=' + encodeURIComponent(note.slice(0, 500)),
    // Returned as RESULT_REQUEST_METADATA in the callback.
    ...(state ? ['S.com.squareup.pos.REQUEST_METADATA=' + encodeURIComponent(JSON.stringify(state))] : []),
  ].join(';');
  return `intent:#Intent;action=com.squareup.pos.action.CHARGE;package=com.squareup;${params};end`;
}

export interface OpenResult {
  /** False when nothing could plausibly open — caller should show the fallback. */
  attempted: boolean;
  /** True when the link had the amount prefilled rather than a bare app open. */
  prefilled: boolean;
}

/**
 * Opens Square POS, with the amount prefilled when possible. Pass no amount to
 * just launch the app.
 */
export function openSquarePos(amountCents?: number, note?: string, state?: PosState): OpenResult {
  const bare = 'square-commerce-v1://payment/create';

  if (amountCents && amountCents > 0) {
    const url = isAndroid()
      ? androidChargeUrl(amountCents, note || '', state)
      : isIos()
        ? iosChargeUrl(amountCents, note || '', state)
        : null;
    if (url) {
      window.location.href = url;
      return { attempted: true, prefilled: true };
    }
  }

  if (isIos() || isAndroid()) {
    window.location.href = bare;
    return { attempted: true, prefilled: false };
  }

  // Desktop: there is no app to open.
  return { attempted: false, prefilled: false };
}
