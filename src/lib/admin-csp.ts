/**
 * The admin Content-Security-Policy (§15), as one pure function.
 *
 * It lives here rather than inside `middleware.ts` so that the browser test can
 * serve **the exact header the app serves** instead of a copy of it. A test
 * that asserts a second, hand-written policy string proves only that two
 * strings match.
 *
 * ## Why the admin panel gets a policy the public site cannot afford
 *
 * The public site runs `script-src 'self' 'unsafe-inline'`, and `next.config.ts`
 * explains at length why: a nonce has to be unique per response, which means
 * rendering per request, and the public pages are statically generated and
 * cache-served. The admin panel is the opposite case on every count — it is
 * authenticated, dynamic already, nothing about it is cacheable, and it is the
 * only surface where a stored-XSS bug would reach booking data and customer
 * records.
 *
 * The nonce reaches Next's own bootstrap scripts by being on the **request**
 * header: Next parses `Content-Security-Policy` off the incoming request, finds
 * the `nonce-` value, and stamps it on every script tag it renders. That is why
 * `guardAdmin` sets the header in both directions.
 *
 * `style-src` keeps `'unsafe-inline'`. React writes inline `style` attributes,
 * and an attribute cannot carry a nonce; CSP Level 3's `'unsafe-hashes'` would
 * be the alternative and buys nothing here, since the threat this policy is
 * built against is script execution.
 *
 * ## `'wasm-unsafe-eval'`, and specifically not `'unsafe-eval'`
 *
 * Phase 12's invoice PDF is laid out by `yoga-layout`, the Flexbox engine
 * `@react-pdf/layout` depends on, which is Emscripten-compiled WebAssembly
 * inlined into the bundle. Under the policy as first written, generating a PDF
 * failed outright on desktop and iPhone alike:
 *
 *     Aborted(CompileError: WebAssembly.instantiate(): Compiling or
 *     instantiating WebAssembly module violates the following Content Security
 *     policy directive because 'unsafe-eval' is not an allowed source of script
 *
 * That message names `'unsafe-eval'`, and taking it at its word would have been
 * the wrong fix: that keyword also re-opens `eval()`, `new Function()` and
 * string timers across the entire panel — the whole policy weakened for one
 * feature. `'wasm-unsafe-eval'` is a separate CSP Level 3 keyword that permits
 * WebAssembly compilation **and nothing else**; `eval('1+1')` still throws
 * under it, which `tests/invoice-browser.test.ts` asserts in a real browser so
 * that a future "fix" reaching for `'unsafe-eval'` fails the suite.
 *
 * The keyword survives `'strict-dynamic'`: strict-dynamic suppresses host and
 * `'self'` allow-lists, not the eval keywords, so the two combine as written.
 *
 * Nothing else moved. The WASM is inlined in the JavaScript rather than fetched,
 * so `connect-src` stays `'self'`, and **the public policy in `next.config.ts`
 * is untouched** — the public site runs no WebAssembly.
 *
 * The cost is an operational one and it belongs in front of the business, not in
 * a code comment: `'wasm-unsafe-eval'` needs **iOS 16.4+ / Safari 16.4+**.
 * Recorded as §19 item 25.
 */
export function adminCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // 'wasm-unsafe-eval' is WebAssembly only — see the note above. Do not
    // replace it with 'unsafe-eval'.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    // `blob:` is for the Phase 12 invoice PDF, which is rendered in the
    // browser and previewed from an object URL.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
