import { describe, expect, it, vi } from 'vitest';

import { toConfidential } from '@/lib/pdf/to-confidential';

import { FULL, MARK } from './helpers/invoice-fixture';

/**
 * Why the admin CSP carries `'wasm-unsafe-eval'` at all (§15).
 *
 * `tests/invoice-browser.test.ts` proves the policy permits what the PDF needs.
 * This proves the *need* — that rendering an invoice really does instantiate
 * WebAssembly, through `@react-pdf/layout` → `yoga-layout`, the Emscripten-built
 * Flexbox engine. Without it, the policy keyword looks like an unexplained
 * loosening that a later reader would be right to try removing.
 *
 * If a future `@react-pdf/renderer` drops WebAssembly, this test fails — and
 * that failure is the signal to **tighten** the policy again rather than to
 * relax the test. Say so in the failure message, because the person reading it
 * will not have this context.
 */
describe('the invoice PDF depends on WebAssembly (§15)', () => {
  it('instantiates a module while rendering, which is what the CSP permits', async () => {
    const instantiate = vi.spyOn(WebAssembly, 'instantiate');
    const compile = vi.spyOn(WebAssembly, 'compile');

    // Imported after the spies are in place: yoga is instantiated lazily, but
    // a static import at the top of this file could beat them to it.
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { InvoiceConfidentialDocument } = await import(
      '@/components/pdf/invoice-confidential-document'
    );

    const buffer = await renderToBuffer(
      InvoiceConfidentialDocument({
        data: toConfidential(FULL),
        markSrc: MARK,
      }) as Parameters<typeof renderToBuffer>[0],
    );

    expect(buffer.length).toBeGreaterThan(1000);

    const usedWasm =
      instantiate.mock.calls.length > 0 || compile.mock.calls.length > 0;

    expect(
      usedWasm,
      "Rendering an invoice no longer touches WebAssembly. If @react-pdf/renderer " +
        "has dropped it, remove 'wasm-unsafe-eval' from adminCsp() in " +
        'src/lib/admin-csp.ts and delete this test — do not weaken either to make ' +
        'this pass.',
    ).toBe(true);

    instantiate.mockRestore();
    compile.mockRestore();
  }, 60_000);
});
