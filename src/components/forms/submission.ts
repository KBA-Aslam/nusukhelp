/**
 * Turning an API failure into a message key.
 *
 * Shared by both forms because there is one set of failure reasons — the two
 * endpoints deliberately answer with the same vocabulary (see the route
 * handlers) — and two copies would drift the moment a reason was added.
 *
 * The endpoints never say which guard rejected a request, so this cannot
 * either. `rejected` covers a failed Turnstile verification, which is also what
 * an unsolved or expired challenge looks like from outside: "complete the
 * verification and try again" is both the honest reading and the useful one.
 */
export function errorKeyFor(reason: string | undefined): string {
  switch (reason) {
    case 'rate_limited':
      return 'rateLimited';
    case 'rejected':
      return 'rejected';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'generic';
  }
}
