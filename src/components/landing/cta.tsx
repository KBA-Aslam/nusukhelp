import type { ReactNode } from 'react';

import { Bidi } from '@/components/ui/bidi';
import { Link } from '@/i18n/navigation';

/**
 * The four button treatments the prototype uses, and the arrow link.
 *
 * Every one is at least 44px tall — §20's tap-target floor applies to the
 * public site too, not only the admin panel, since most pilgrim traffic in this
 * market is on a phone.
 *
 * `href` starting with `http` (WhatsApp, mail) renders a plain anchor; anything
 * else goes through the locale-aware `Link`, which adds the `/en` or `/ar`
 * prefix. Getting that wrong is the classic way to ship a link that silently
 * drops the locale.
 */

type Variant = 'primary' | 'gilt' | 'outlineOnDark' | 'outlineOnLight';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-verdant text-white hover:bg-pine',
  gilt: 'bg-gilt text-ink hover:bg-brass',
  outlineOnDark:
    'border border-white/70 text-white hover:border-white hover:bg-white/10',
  outlineOnLight:
    'border border-hairline text-ink hover:border-brass hover:bg-mist/60',
};

export function ButtonLink({
  href,
  variant,
  children,
  className = '',
  fullWidthOnMobile = false,
}: {
  href: string;
  variant: Variant;
  children: string;
  className?: string;
  fullWidthOnMobile?: boolean;
}) {
  const classes = [
    'inline-flex min-h-11 items-center justify-center rounded-[2px] px-6 text-sm font-semibold tracking-[0.03em] transition-colors',
    VARIANT[variant],
    fullWidthOnMobile ? 'w-full sm:w-auto' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const label = <Bidi>{children}</Bidi>;

  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {label}
    </Link>
  );
}

/**
 * A text link with the prototype's trailing arrow.
 *
 * The arrow is decoration, not content: it is `aria-hidden`, it sits outside
 * `<Bidi>` so it is never dragged into the isolated text run, and it mirrors on
 * `/ar` with `rtl:-scale-x-100` (§6) — an arrow pointing right in a
 * right-to-left page points backwards.
 */
export function ArrowLink({
  href,
  children,
  className = '',
  sublabel,
}: {
  href: string;
  children: string;
  className?: string;
  sublabel?: ReactNode;
}) {
  const inner = (
    <>
      <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
        <Bidi>{children}</Bidi>
        <span aria-hidden="true" className="inline-block rtl:-scale-x-100">
          →
        </span>
      </span>
      {sublabel}
    </>
  );

  const classes = `group inline-flex flex-col transition-colors ${className}`;

  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {inner}
    </Link>
  );
}
