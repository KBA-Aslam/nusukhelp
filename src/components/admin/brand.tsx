import Image from 'next/image';

import { LOGO } from '@/lib/site';

/**
 * The Al Haramain lockup — **the only mark that appears anywhere in `/admin`**
 * (§7, *Logo placement — enforced, not advisory*).
 *
 * The rule is worth restating where it is easy to break: the admin panel is an
 * Al Haramain Reservation surface, and the Nusuk Help mark does not belong on
 * any screen in it. Same for the invoice PDF in Phase 12. The public header and
 * footer are the reverse case. Importing `LOGO.ahrTile` here rather than in
 * each screen means there is one import to check.
 */
export function AlHaramainLockup({
  size = 'md',
}: {
  size?: 'sm' | 'md';
}) {
  const px = size === 'sm' ? 34 : 46;

  return (
    <span className="flex items-center gap-3">
      <Image
        src={LOGO.ahrTile.src}
        width={LOGO.ahrTile.width}
        height={LOGO.ahrTile.height}
        alt=""
        aria-hidden="true"
        priority
        className="h-auto shrink-0 rounded-[2px]"
        style={{ width: px }}
      />
      <span className="leading-tight">
        <span className="block font-display text-[0.9375rem] tracking-[0.18em] text-gilt">
          AL HARAMAIN
        </span>
        <span className="block text-[0.6875rem] tracking-[0.26em] text-onink-muted uppercase">
          Reservation
        </span>
      </span>
    </span>
  );
}
