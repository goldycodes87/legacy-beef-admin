/**
 * Email Template Helpers for Legacy Land & Cattle
 * Consistent branding, responsive design, semantic HTML
 */

// ─── Brand Colors ──────────────────────────────────────────────────────────
const COLORS = {
  GREEN: '#1A3D2B',
  ORANGE: '#E85D24',
  WARM: '#F5F0E8',
  DARK: '#0F0F0F',
  GRAY: '#6B7280',
  GOLD: '#C4A46B',
  LIGHT_GRAY: '#f0ece4',
  VERY_LIGHT_GRAY: '#F3F4F6',
  LIGHT_ORANGE: '#fff7ed',
  LIGHT_ORANGE_BORDER: '#fed7aa',
  LIGHT_GREEN_BG: '#F0F7E8',
  LIGHT_GREEN_BORDER: '#c3dfa0',
};

// ─── Cut Sheet Section Mapping ──────────────────────────────────────────────
const CUT_SHEET_SECTIONS = {
  chuck: { label: 'Chuck', emoji: '🥩' },
  brisket: { label: 'Brisket', emoji: '🥩' },
  skirt: { label: 'Skirt', emoji: '🍖' },
  rib: { label: 'Rib', emoji: '🥩' },
  short_ribs: { label: 'Short Ribs', emoji: '🍖' },
  sirloin: { label: 'Sirloin', emoji: '🥩' },
  round: { label: 'Round', emoji: '🥩' },
  short_loin: { label: 'Short Loin', emoji: '🥩' },
  flank: { label: 'Flank', emoji: '🍖' },
  stew_meat: { label: 'Stew Meat', emoji: '🍲' },
  tenderized_round: { label: 'Tenderized Round', emoji: '🥩' },
  organs: { label: 'Organs', emoji: '🫀' },
  bones: { label: 'Bones', emoji: '🦴' },
  packing: { label: 'Packing', emoji: '📦' },
};

// ─── emailBase(content, preheader?) ─────────────────────────────────────────
/**
 * Wraps email content in a full HTML envelope with header, body, and footer.
 * Returns complete HTML email with DOCTYPE, meta, preheader (hidden), branded header,
 * white content body, and footer.
 */
export function emailBase(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legacy Land & Cattle</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #ffffff;
      margin: 0;
      padding: 20px;
    }
    table {
      border-collapse: collapse;
    }
    a {
      text-decoration: none;
      color: inherit;
    }
  </style>
</head>
<body style="background-color: #ffffff; margin: 0; padding: 20px; font-family: Arial, sans-serif;">
  ${
    preheader
      ? `<div style="font-size: 0; color: #ffffff; display: none; max-height: 0; line-height: 0; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
  </div>`
      : ''
  }

  <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background: #f4f4f4; border-radius: 16px; overflow: hidden;">
    <tr>
      <td style="padding: 20px; background: #f4f4f4;">
        <table role="presentation" style="width: 100%; background: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: ${COLORS.GREEN}; padding: 40px 20px; text-align: center;">
              <div style="margin-bottom:16px;">
                <img src="https://www.legacylandandcattleco.com/images/LLC_Logo_white.svg" alt="Legacy Land & Cattle" width="140" height="60" style="width:140px;height:auto;display:block;margin:0 auto;" />
              </div>
              <h1 style="font-family: Georgia, serif; color: white; font-size: 28px; margin: 0 0 8px; font-weight: normal;">
                Legacy Land & Cattle
              </h1>
              <p style="color: ${COLORS.GOLD}; font-size: 12px; margin: 0; font-family: Arial, sans-serif; letter-spacing: 1px;">
                Ranch Direct · Colorado Springs, CO
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px; color: ${COLORS.DARK}; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.VERY_LIGHT_GRAY}; padding: 30px 20px; text-align: center; border-top: 1px solid ${COLORS.LIGHT_GRAY};">
              <p style="font-size: 12px; color: ${COLORS.GRAY}; margin: 0 0 8px; font-family: Arial, sans-serif;">
                <strong>Legacy Land & Cattle</strong><br>
                6105 Burgess Rd, Colorado Springs, CO 80908
              </p>
              <p style="font-size: 12px; color: ${COLORS.GRAY}; margin: 0; font-family: Arial, sans-serif;">
                <a href="mailto:orders@legacylandandcattleco.com" style="color: ${COLORS.ORANGE}; text-decoration: none;">
                  orders@legacylandandcattleco.com
                </a><br />
                <a href="tel:+17192581777" style="color: ${COLORS.ORANGE}; text-decoration: none;">
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

// ─── ctaButton(text, url, color?) ──────────────────────────────────────────
/**
 * Renders a styled CTA button as an inline table.
 * Default color is orange (#E85D24).
 */
export function ctaButton(
  text: string,
  url: string,
  color: string = COLORS.ORANGE
): string {
  return `<table role="presentation" style="margin: 20px auto 0; display: inline-block; width: 100%; max-width: 100%;">
    <tr>
      <td style="text-align: center;">
        <a href="${url}" style="
          display: inline-block;
          background-color: ${color};
          color: white;
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-weight: bold;
          padding: 16px 40px;
          border-radius: 10px;
          text-decoration: none;
          letter-spacing: 0.5px;
          line-height: 1;
        ">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

// ─── orderCard(fields) ────────────────────────────────────────────────────
/**
 * Renders a styled card with label/value pairs.
 * Used for order details, pickup info, payment receipts, etc.
 */
export function orderCard(
  fields: Array<{ label: string; value: string }>
): string {
  const rows = fields
    .map(
      (field) => `
    <tr>
      <td style="
        padding: 12px 0;
        border-bottom: 1px solid #eeeeee;
        font-size: 13px;
        color: ${COLORS.GRAY};
        font-family: Arial, sans-serif;
        width: 40%;
      ">
        ${field.label}
      </td>
      <td style="
        padding: 12px 0;
        border-bottom: 1px solid #eeeeee;
        font-size: 13px;
        color: ${COLORS.DARK};
        font-weight: bold;
        font-family: Arial, sans-serif;
        text-align: right;
        width: 60%;
      ">
        ${field.value}
      </td>
    </tr>
  `
    )
    .join('');

  return `<table role="presentation" style="background:#f9f9f9;border-radius:10px;margin:20px 0;border-left:4px solid #E85D24;width:100%;padding:20px 24px;border-collapse:collapse;">
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}

// ─── formatAnswers(answers) Helper ───────────────────────────────────────
/**
 * Formats cut sheet answers for display.
 * Handles: house_default, choice (string/boolean), choices (array),
 * thickness, fat_pct, lbs_per_pack
 */
function formatAnswers(answers: any): string {
  if (!answers) return 'Not specified';

  const parts: string[] = [];

  // Check for house default
  if (answers.house_default) {
    return 'House default';
  }

  // Handle choice (string)
  if (typeof answers.choice === 'string') {
    parts.push(answers.choice.charAt(0).toUpperCase() + answers.choice.slice(1));
  }

  // Handle choice (boolean)
  if (typeof answers.choice === 'boolean') {
    parts.push(answers.choice ? 'Yes' : 'No / Skip');
  }

  // Handle choices (array)
  if (Array.isArray(answers.choices)) {
    parts.push(answers.choices.join(' · '));
  }

  // Handle thickness
  if (answers.thickness) {
    parts.push(`${answers.thickness} thick`);
  }

  // Handle fat_pct
  if (answers.fat_pct) {
    parts.push(`${answers.fat_pct} fat`);
  }

  // Handle lbs_per_pack
  if (answers.lbs_per_pack) {
    parts.push(`${answers.lbs_per_pack} lb packs`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Not specified';
}

// ─── cutSheetSummary(answers) ──────────────────────────────────────────────
/**
 * Renders a summary of cut sheet answers.
 * Maps 14 sections with emoji icons and formatted answers.
 * Uses the same styling as orderCard.
 */
export function cutSheetSummary(
  answers: Array<{ section: string; answers: any; completed?: boolean }>
): string {
  const rows = answers
    .map((item) => {
      const sectionKey = item.section as keyof typeof CUT_SHEET_SECTIONS;
      const sectionInfo = CUT_SHEET_SECTIONS[sectionKey] || {
        label: item.section,
        emoji: '📋',
      };
      const formatted = formatAnswers(item.answers);

      return `
    <tr>
      <td style="
        padding: 12px 0;
        border-bottom: 1px solid #eeeeee;
        font-size: 13px;
        color: ${COLORS.DARK};
        font-family: Arial, sans-serif;
        width: 40%;
      ">
        <span style="margin-right: 8px;">${sectionInfo.emoji}</span>${sectionInfo.label}
      </td>
      <td style="
        padding: 12px 0;
        border-bottom: 1px solid #eeeeee;
        font-size: 13px;
        color: ${COLORS.DARK};
        font-weight: bold;
        font-family: Arial, sans-serif;
        text-align: right;
        width: 60%;
      ">
        ${formatted}
      </td>
    </tr>
  `;
    })
    .join('');

  return `<table role="presentation" style="background:#f9f9f9;border-radius:10px;margin:20px 0;border-left:4px solid #E85D24;width:100%;padding:20px 24px;border-collapse:collapse;">
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}
