import type { ReactNode } from 'react';

/**
 * The admin panel's shared primitives.
 *
 * Small, unopinionated and deliberately few — a card, a page heading, a status
 * pill, a couple of button and input class strings. §7's quality floor is flat:
 * hairline rules, a 2px radius, no drop shadows, and the ogee arch reserved for
 * the two places the public site uses it. There is no shadow or gradient in
 * this file for that reason.
 *
 * Three §20 rules are encoded in the class strings rather than left to each
 * screen, exactly as `components/forms/fields.tsx` does for the public forms —
 * they are the rules that get remembered on four controls and forgotten on the
 * fifth:
 *
 *  - **16px on every input.** Below that, iOS Safari zooms the viewport on
 *    focus and does not zoom back (§20.1).
 *  - **44px minimum on every tap target**, via `min-h-11`.
 *  - **Logical properties only** — `ms-*`, `ps-*`, `text-start`. The panel is
 *    LTR-only today, but these components are the ones a future Arabic admin
 *    would inherit, and mixing the two conventions is how that becomes a
 *    rewrite instead of a locale switch.
 */

/* --------------------------------------------------------------------------
   Layout
   -------------------------------------------------------------------------- */

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2px] border border-hairline bg-white">
      {title ? (
        <header className="border-b border-hairline px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-muted">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** The empty state a list shows before anything exists. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-muted sm:px-5">
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Status
   -------------------------------------------------------------------------- */

const PILL_TONE = {
  /** Live, good, in force. */
  positive: 'border-verdant/30 bg-verdant/10 text-verdant',
  /** Waiting on someone. */
  pending: 'border-brass/40 bg-brass/10 text-brass-ink',
  /** Over, withdrawn, switched off. Not an error — just no longer in force. */
  neutral: 'border-hairline bg-mist text-slate',
  /** Something went wrong or was refused. */
  negative: 'border-error/30 bg-error/10 text-error',
} as const;

export type PillTone = keyof typeof PILL_TONE;

/**
 * A status pill.
 *
 * Colour is never the only signal — the word is the signal, and the tone is
 * reinforcement (§7 quality floor, and the same rule the public forms follow
 * for validation errors).
 */
export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase ${PILL_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Controls

   Class strings rather than components, so a caller can put them on whichever
   element it actually needs — a `button`, a `Link`, a `label`. Wrapping each in
   a component would mean forwarding every prop of three different elements for
   no gain.
   -------------------------------------------------------------------------- */

const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55';

export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-verdant text-white hover:bg-pine`;

export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-hairline bg-white text-ink hover:border-verdant`;

/**
 * For the action a person should stop and think about before taking —
 * deactivating an account, revoking an invitation.
 *
 * Outlined rather than filled: a solid red button in a table of rows is
 * shouting, and §7 keeps the panel flat. The weight it carries comes from being
 * the only red thing on the screen.
 */
export const BUTTON_DANGER = `${BUTTON_BASE} border border-error/40 bg-white text-error hover:bg-error/5`;

/** 16px, 44px tall, and a visible invalid state. See the note at the top. */
export const INPUT =
  'w-full min-h-11 rounded-[2px] border border-hairline bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-placeholder transition-colors focus:border-verdant aria-[invalid=true]:border-error';

export function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.8125rem] font-semibold text-ink"
    >
      {children}
    </label>
  );
}

/**
 * A form-level message.
 *
 * `role="alert"` so that a screen reader announces it when it appears — a
 * failed sign-in that is only red is a failed sign-in a blind user does not
 * know about.
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <p
      role="alert"
      className={`rounded-[2px] border px-3 py-2.5 text-sm ${
        tone === 'error'
          ? 'border-error/30 bg-error/5 text-error'
          : 'border-verdant/30 bg-verdant/5 text-verdant'
      }`}
    >
      {children}
    </p>
  );
}
