/**
 * `3450` → *"Three Thousand Four Hundred Fifty Saudi Riyals Only"* (§10).
 *
 * One converter, because there is one currency (§8): whole Saudi Riyals, no
 * minor units, so nothing here handles decimals, halalas, or a second currency
 * name. The full invoice is the only caller — the confidential style has no
 * amount to spell, and `InvoiceConfidentialData` has no field to spell it into.
 *
 * The words are derived from `totalValue` at render time rather than carried on
 * the invoice data, so the document cannot end up holding a total in digits and
 * a different one in prose.
 */

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty',
  'Ninety',
];

/** Ascending, so the loop below can take them three digits at a time. */
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

/** 1–999. */
function underThousand(n: number): string {
  const parts: string[] = [];

  const hundreds = Math.floor(n / 100);
  if (hundreds > 0) parts.push(ONES[hundreds], 'Hundred');

  const rest = n % 100;
  if (rest > 0 && rest < 20) {
    parts.push(ONES[rest]);
  } else if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]);
  }

  return parts.join(' ');
}

/** The number alone, no currency. Exported for the tests. */
export function numberInWords(value: number): string {
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return 'Zero';

  const groups: string[] = [];
  let remaining = n;
  let scale = 0;

  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) {
      groups.unshift(
        scale > 0
          ? `${underThousand(group)} ${SCALES[scale]}`
          : underThousand(group),
      );
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }

  return groups.join(' ');
}

/**
 * The line the invoice prints.
 *
 * Negative totals are possible — a discount larger than the booking, or an edit
 * that inverts one — and printing *"Minus Four Hundred Saudi Riyals Only"* is
 * the honest rendering of a figure the digits already show as negative.
 */
export function amountInWords(riyals: number): string {
  const unit = Math.abs(Math.trunc(riyals)) === 1 ? 'Saudi Riyal' : 'Saudi Riyals';
  const sign = riyals < 0 ? 'Minus ' : '';

  return `${sign}${numberInWords(riyals)} ${unit} Only`;
}
