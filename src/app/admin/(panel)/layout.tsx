import { headers } from 'next/headers';

import { AdminShell } from '@/components/admin/admin-shell';
import { requirePageAccess } from '@/lib/auth-guard';

/**
 * Everything behind the sign-in wall.
 *
 * The route group `(panel)` contributes nothing to the URL — `page.tsx` beside
 * this file is still `/admin` — and exists so that this layout can hold the
 * guard and the chrome without `/admin/login` and `/admin/accept-invite/[token]`
 * inheriting either. Someone who is not signed in must not be shown navigation
 * they cannot follow, and the login screen must not redirect to itself.
 *
 * `requirePageAccess` here is the first of §12's two *real* checks — the
 * middleware's cookie test is a courtesy, not a boundary. It is not the last
 * either: this layout guards what renders, and every server action beneath it
 * re-checks independently, because an action is a POST that can be made without
 * ever loading the page.
 *
 * `force-dynamic` because the whole subtree depends on the session. Without it
 * a page with no other dynamic input could be prerendered at build time and
 * served to whoever asked.
 */

export const dynamic = 'force-dynamic';

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageAccess();
  const pathname = (await headers()).get('x-admin-path') ?? '/admin';

  return (
    <AdminShell user={user} pathname={pathname}>
      {children}
    </AdminShell>
  );
}
