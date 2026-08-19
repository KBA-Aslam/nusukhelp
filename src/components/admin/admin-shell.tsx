import Link from 'next/link';

import { signOutAction } from '@/app/admin/actions';
import { AlHaramainLockup } from '@/components/admin/brand';
import type { AuthUser } from '@/lib/auth';
import { roleCan, type Capability } from '@/lib/permissions';
import { ROLE_LABEL } from '@/lib/roles';

/**
 * The panel chrome — ink sidebar, page body, signed-in user (§7, prototype
 * `04-admin-dashboard-desktop.svg`).
 *
 * ## No client JavaScript
 *
 * The mobile navigation is a `<details>` element. That is not a shortcut: it
 * gives a real disclosure widget with keyboard support and the correct
 * announcements for free, it works before hydration, and it needs no state to
 * be reset when the route changes — the sidebar being an unclosed menu after
 * navigation is the usual bug in the hand-rolled version. §20.3 also rules out
 * anything revealed on hover, which a CSS-only dropdown would be.
 *
 * ## Navigation lists only the routes that exist
 *
 * The prototype's sidebar has ten entries; Phase 8 has built two of them.
 * Rendering the other eight greyed out would put eight dead links in front of
 * staff on the day the panel opens, and the footer on the public site made the
 * same decision for the same reason. Each phase adds its own entry to `NAV`.
 */

type NavEntry = {
  href: string;
  label: string;
  /** Who sees it. The route enforces the same capability server-side (§12). */
  capability: Capability;
  /** Matches `/admin/settings/...` as well as the exact href. */
  prefix?: boolean;
};

const NAV: readonly NavEntry[] = [
  { href: '/admin', label: 'Dashboard', capability: 'viewPanel' },
  {
    href: '/admin/settings/users',
    label: 'Users',
    capability: 'manageUsers',
    prefix: true,
  },
];

function visibleNav(user: AuthUser): NavEntry[] {
  return NAV.filter((entry) => roleCan(user.role, entry.capability));
}

export function AdminShell({
  user,
  pathname,
  children,
}: {
  user: AuthUser;
  /** Current path, from the `x-admin-path` header the middleware sets. */
  pathname: string;
  children: React.ReactNode;
}) {
  const entries = visibleNav(user);

  return (
    <div className="min-h-dvh md:flex">
      {/* --- Mobile bar ------------------------------------------------ */}
      <header className="bg-ink md:hidden">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <AlHaramainLockup size="sm" />
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-onink">
              <MenuIcon />
              <span className="sr-only">Menu</span>
            </span>
          </summary>

          <nav aria-label="Admin" className="border-t border-white/10 px-2 pb-3">
            <NavList entries={entries} pathname={pathname} />
          </nav>

          <UserPanel user={user} className="border-t border-white/10 px-4 py-4" />
        </details>
      </header>

      {/* --- Desktop sidebar -------------------------------------------
          236px, matching the prototype. `sticky` rather than `fixed`: §20.3
          warns off `position: fixed` near focused inputs because iOS
          repositions fixed elements unpredictably when the keyboard opens. */}
      <div className="hidden w-[236px] shrink-0 bg-ink md:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="px-5 py-6">
            <AlHaramainLockup />
          </div>

          <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2">
            <NavList entries={entries} pathname={pathname} />
          </nav>

          <UserPanel user={user} className="border-t border-white/10 px-4 py-4" />
        </div>
      </div>

      {/* --- Page ------------------------------------------------------- */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function NavList({
  entries,
  pathname,
}: {
  entries: NavEntry[];
  pathname: string;
}) {
  return (
    <ul className="space-y-0.5 py-1">
      {entries.map((entry) => {
        const path = pathname.split('?')[0];
        const current = entry.prefix
          ? path === entry.href || path.startsWith(`${entry.href}/`)
          : path === entry.href;

        return (
          <li key={entry.href}>
            <Link
              href={entry.href}
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-[2px] px-3 text-sm transition-colors ${
                current
                  ? 'bg-panel font-semibold text-gilt'
                  : 'text-onink hover:bg-panel-deep hover:text-white'
              }`}
            >
              {entry.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserPanel({
  user,
  className,
}: {
  user: AuthUser;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
      <p className="mt-0.5 text-xs text-onink-muted">
        {ROLE_LABEL[user.role]}
      </p>

      <form action={signOutAction}>
        <button
          type="submit"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-gilt hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

/**
 * Three rules. The `<summary>` rotates nothing and swaps nothing — the panel
 * opening below it is the affordance, and an icon that animates would be one
 * more thing to get wrong on a browser that does not hydrate.
 */
function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M2.5 5h15M2.5 10h15M2.5 15h15" />
    </svg>
  );
}
