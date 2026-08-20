import { pdf } from '@react-pdf/renderer';

import { InvoiceConfidentialDocument } from '@/components/pdf/invoice-confidential-document';
import { toConfidential } from '@/lib/pdf/to-confidential';

import { FULL, MARK } from '../helpers/invoice-fixture';

/**
 * The page `tests/invoice-browser.test.ts` loads in a real Chrome, under the
 * real admin Content-Security-Policy.
 *
 * It imports the same document component and the same sanitiser the panel does,
 * so what runs here is the actual PDF pipeline rather than an imitation of it.
 * The mark is the fixture's data URI, so nothing is fetched: the only thing
 * under test is what the policy permits.
 */

declare global {
  interface Window {
    generateInvoice: () => Promise<GenerateResult>;
    evalVerdict: string;
  }
}

type GenerateResult =
  | { ok: true; bytes: number; head: string }
  | { ok: false; error: string };

window.generateInvoice = async (): Promise<GenerateResult> => {
  try {
    const blob = await pdf(
      <InvoiceConfidentialDocument data={toConfidential(FULL)} markSrc={MARK} />,
    ).toBlob();

    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      ok: true,
      bytes: bytes.length,
      head: String.fromCharCode(...bytes.slice(0, 5)),
    };
  } catch (cause) {
    // The CSP failure arrives as an Emscripten abort wrapping a CompileError,
    // so the message matters as much as the type.
    return {
      ok: false,
      error:
        cause instanceof Error
          ? `${cause.name}: ${cause.message}`
          : String(cause),
    };
  }
};

/**
 * Whether `eval()` on a string runs — **evaluated as page script, at load.**
 *
 * This is the assertion that keeps the fix honest. `'wasm-unsafe-eval'` permits
 * WebAssembly and nothing else; if someone later "fixes" a CSP error by
 * reaching for `'unsafe-eval'` instead, the PDF would still generate and every
 * other test would still pass — this is what turns red.
 *
 * It runs here, during module evaluation, rather than in a function the test
 * calls. Chrome does not apply the page's CSP to string `eval` reached through
 * a debugger-initiated evaluation, so a probe invoked from `page.evaluate()`
 * reports `allowed: 2` under a policy that in fact forbids eval — a false
 * negative on the one assertion that must not have one. WebAssembly *is* still
 * policed on that path, which is why generation can stay a callable function.
 */
window.evalVerdict = (() => {
  try {
    // Indirect, so a bundler cannot rewrite it into something else.
    const run = eval;
    return `allowed: ${run('1+1')}`;
  } catch (cause) {
    return `blocked: ${cause instanceof Error ? cause.name : 'unknown'}`;
  }
})();
