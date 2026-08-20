'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { BUTTON_DANGER, BUTTON_SECONDARY } from '@/components/admin/ui';

/**
 * A warning that has to be **seen** before it counts (§9.3, §9.4).
 *
 * ## Why this component exists
 *
 * Phase 11's live test recorded an edit as having "saved silently". It had not
 * saved at all: the action returned the §9.3 overpayment warning and refused
 * the write, exactly as designed, and the panel carrying that warning rendered
 * at the top of a seven-step form while the **Save changes** button sat in the
 * sticky bar at the bottom of a phone screen. Nothing scrolled, nothing took
 * focus, and the bar said nothing. From where the person was sitting the tap
 * did nothing, which reads as *saved*.
 *
 * A confirm-then-repeat design has one hard requirement — that the person
 * actually sees the sentence they are being asked to confirm. Meeting it is not
 * the caller's business to remember, so it lives here:
 *
 * - `scrollIntoView` on mount, because the button that triggers this is
 *   routinely a screenful away from where the answer renders;
 * - focus on mount, so a keyboard or screen-reader user lands on it rather than
 *   continuing from wherever they were;
 * - `role="alert"`, so it is announced;
 * - and the copy states plainly that **nothing has been saved**, because the
 *   failure mode this replaces was someone believing the opposite.
 *
 * Both the booking form (§9.3) and the payment panel (§9.4) use it. Two
 * warning panels would mean two chances to forget the scroll.
 */
export function WarningPanel({
  warnings,
  pending,
  proceedLabel,
  onProceed,
  onCancel,
  cancelLabel = 'Go back',
}: {
  warnings: readonly string[];
  pending?: boolean;
  /** Says what proceeding does — "Save anyway", "Record it anyway". */
  proceedLabel: string;
  onProceed: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-[2px] border border-brass/40 bg-brass/5 px-4 py-3.5 outline-none focus-visible:border-brass"
    >
      <ul className="space-y-1.5 text-sm text-ink">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>

      <p className="mt-2 text-xs font-semibold text-ink">
        Nothing has been saved yet.
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onProceed}
          disabled={pending}
          className={BUTTON_DANGER}
        >
          {proceedLabel}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * The counterpart for something that **did** happen.
 *
 * Same reasoning from the other side: the reversal action computes
 * *"Payment reversed. Paid is now SAR 1,175."* and the first build discarded
 * it, leaving a person who had just reversed a payment with no confirmation
 * that anything had — which is indistinguishable from a reversal that failed.
 */
export function ActionMessage({
  tone = 'success',
  children,
}: {
  tone?: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`text-sm ${tone === 'error' ? 'text-error' : 'text-verdant'}`}
    >
      {children}
    </p>
  );
}
