import { AlHaramainLockup } from '@/components/admin/brand';
import en from '@/messages/en.json';

/**
 * The two screens reached without a session — `/admin/login` and
 * `/admin/accept-invite/[token]`.
 *
 * A single centred card on the ink ground, and no navigation: there is nothing
 * a signed-out visitor could usefully be offered, and a sidebar full of links
 * that all redirect back here is worse than none. The Al Haramain mark is the
 * only mark, here as everywhere in `/admin` (§7).
 *
 * `force-dynamic` because both children read per-request state — the login form
 * its `next` parameter, the accept-invite page its token. Neither may be
 * prerendered or cached.
 */

export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-7 flex justify-center">
          <AlHaramainLockup />
        </div>

        <div className="rounded-[2px] border border-white/10 bg-white p-6 sm:p-7">
          {children}
        </div>

        {/*
          The affiliation disclaimer is required sitewide (Appendix A), and
          "sitewide" includes the screens staff see — this is the first screen
          anyone joining the company sees the company describe itself on.

          It is **read out of `messages/en.json`, not retyped.** §19 item 1
          makes the disclaimer a legal statement that goes to the advisor as an
          English/Arabic pair and must not be quietly rewritten; a second copy
          in a component is exactly how the reviewed wording and the shipped
          wording come apart. `/admin/*` carries no locale (§4), so it takes the
          English value directly rather than through next-intl.
        */}
        <p className="mt-7 text-center text-xs leading-relaxed text-onink-muted">
          {en.footer.disclaimer}
        </p>
      </div>
    </div>
  );
}
