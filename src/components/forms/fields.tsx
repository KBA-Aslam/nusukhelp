'use client';

import type { ReactNode } from 'react';

import { Bidi } from '@/components/ui/bidi';
import { HONEYPOT_FIELD } from '@/lib/request-guards';

/**
 * The form primitives both public forms are built from.
 *
 * Three §20 rules are encoded here rather than left to each field, because each
 * of them is the kind that gets remembered on four inputs and forgotten on the
 * fifth:
 *
 *  - **`text-base` on every control.** 16px is the threshold below which iOS
 *    Safari zooms the viewport on focus and does not zoom back — §20.1 names
 *    this as one of the failures that broke the previous billing tool. A
 *    smaller label is fine; a smaller *input* is not.
 *  - **44px minimum height**, via `min-h-11`.
 *  - **Logical properties only** — `ps-*`, `text-start`. These fields render
 *    inside the RTL page.
 *
 * Errors are wired for assistive tech, not just coloured: `aria-invalid` marks
 * the control and `aria-describedby` points at the message, so a screen reader
 * announces the problem when focus lands rather than leaving a red border that
 * only a sighted user can act on.
 */

const CONTROL = [
  'w-full min-h-11 rounded-[2px] border bg-white px-3.5 py-2.5',
  // 16px. See above — this is not a style choice.
  'text-base text-ink placeholder:text-placeholder',
  'transition-colors focus:border-verdant',
].join(' ');

function controlClasses(invalid: boolean): string {
  return `${CONTROL} ${invalid ? 'border-error' : 'border-hairline'}`;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[0.8125rem] font-semibold text-ink"
      >
        <Bidi>{label}</Bidi>
        {/* The asterisk is decoration; `required` on the control is what
            actually announces the requirement. */}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-brass-ink">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate">
          <Bidi>{hint}</Bidi>
        </p>
      ) : null}

      <div className="mt-2">{children}</div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error">
          <Bidi>{error}</Bidi>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The props every control needs to be styled, described and announced
 * correctly.
 *
 * Booleans rather than the error object itself, so a caller cannot accidentally
 * pass a truthy `FieldError` where a string was expected and end up with an
 * `aria-describedby` pointing at an element that was never rendered.
 */
export function fieldProps(
  id: string,
  options: { invalid?: boolean; hint?: boolean } = {},
) {
  const describedBy = [
    options.hint ? `${id}-hint` : null,
    options.invalid ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id,
    className: controlClasses(Boolean(options.invalid)),
    'aria-invalid': options.invalid ? (true as const) : undefined,
    'aria-describedby': describedBy || undefined,
  };
}

/**
 * The honeypot (§14.1).
 *
 * Not `display: none` and not `hidden`: some form-fillers skip fields they can
 * tell are invisible, and a hidden input is trivially detectable. This is a
 * real, focusable-by-nothing text input pushed out of the viewport, with
 * `tabIndex={-1}` so keyboard users never land on it and `aria-hidden` so
 * screen readers never announce it. `autoComplete="off"` stops a browser
 * helpfully filling it for a real person, which would silently discard their
 * submission.
 */
export function Honeypot({
  register,
}: {
  register: Record<string, unknown>;
}) {
  return (
    <div aria-hidden="true" className="absolute -start-[9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor={HONEYPOT_FIELD}>Website</label>
      <input
        {...register}
        id={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
}
