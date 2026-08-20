import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, type Browser } from 'playwright-core';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminCsp } from '@/lib/admin-csp';

/**
 * The invoice PDF, in a real browser, under the real Content-Security-Policy.
 *
 * ## Why this file exists
 *
 * Phase 12 shipped with 35 passing tests and a feature that did not work at
 * all. `pdf().toBlob()` failed on the first tap, on desktop and iPhone alike:
 *
 *     Aborted(CompileError: WebAssembly.instantiate(): Compiling or
 *     instantiating WebAssembly module violates the following Content Security
 *     policy directive because 'unsafe-eval' is not an allowed source of script
 *
 * `@react-pdf/layout` lays every box out with `yoga-layout`, which is
 * Emscripten-compiled WebAssembly, and the admin policy permitted no WASM. Not
 * one of those 35 tests could have caught it, because every one ran in jsdom or
 * in Node — environments where a Content-Security-Policy does not exist. The
 * gap was the real defect: the suite had no way to detect anything that only
 * breaks under a browser policy.
 *
 * So this suite runs the actual pipeline — the same document component, the
 * same sanitiser, the real `@react-pdf/renderer` — in headless Chrome, served
 * under **the exact header `adminCsp()` produces**, imported from the module
 * the middleware calls rather than copied into the test.
 *
 * ## Three assertions, and the second is the durable one
 *
 * 1. Under the shipped policy, a PDF is produced.
 * 2. Under the shipped policy, `eval('1+1')` still throws. `'wasm-unsafe-eval'`
 *    buys WebAssembly and nothing else; a future "fix" that reaches for
 *    `'unsafe-eval'` would generate PDFs happily and pass every other test in
 *    the repo. This is the one that fails. The probe runs as page script at
 *    load — Chrome exempts debugger-initiated evaluation from the eval
 *    restriction, so calling it through `page.evaluate()` reports it allowed
 *    under a policy that forbids it.
 * 3. Under the policy **as it was before the fix** — the same string with the
 *    keyword removed — generation fails with the CompileError above. That is
 *    the negative control: it proves this suite detects the bug it was written
 *    for, rather than passing because Chrome enforced nothing.
 *
 * ## Requirements
 *
 * Google Chrome installed locally (`playwright-core` drives it; no browser is
 * downloaded). Where there is none, the suite **skips loudly** rather than
 * passing quietly — see the console warning below.
 */

const NONCE = 'test-nonce-vsr1qk9';

/** The policy as shipped. */
const SHIPPED_POLICY = adminCsp(NONCE);

/** The policy as it was when Phase 12 shipped broken. */
const POLICY_WITHOUT_WASM = SHIPPED_POLICY.replace(" 'wasm-unsafe-eval'", '');

const chromeAvailable = await (async () => {
  try {
    const probe = await chromium.launch({ channel: 'chrome', headless: true });
    await probe.close();
    return true;
  } catch {
    console.warn(
      '\n[invoice-browser] SKIPPED — no local Google Chrome. The PDF pipeline is ' +
        'therefore unverified against the admin CSP on this machine. Install Chrome ' +
        'and re-run; do not read a green suite as proof the PDF generates.\n',
    );
    return false;
  }
})();

describe.skipIf(!chromeAvailable)(
  'the invoice PDF generates in a browser under the admin CSP (§15)',
  () => {
    let browser: Browser;
    let server: Server;
    let origin: string;
    /** Swapped per test, so one server can serve both policies. */
    let policy = SHIPPED_POLICY;

    beforeAll(async () => {
      // The real pipeline, bundled the way the panel bundles it. Building into
      // the OS temp directory keeps the repository clean.
      const outDir = await mkdtemp(path.join(tmpdir(), 'invoice-browser-'));

      await build({
        root: process.cwd(),
        logLevel: 'error',
        resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
        esbuild: { jsx: 'automatic' },
        build: {
          outDir,
          emptyOutDir: true,
          target: 'es2022',
          minify: false,
          rollupOptions: {
            input: path.resolve(
              process.cwd(),
              'tests/fixtures/invoice-browser-entry.tsx',
            ),
            output: {
              format: 'es',
              entryFileNames: 'entry.js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name][extname]',
            },
          },
        },
      });

      const page = [
        '<!doctype html><html><head><meta charset="utf-8"><title>invoice</title></head>',
        '<body>',
        // The nonce is what `'strict-dynamic'` trusts; the module's own imports
        // inherit that trust, exactly as they do in the panel.
        `<script type="module" nonce="${NONCE}" src="/entry.js"></script>`,
        '</body></html>',
      ].join('');

      server = createServer(async (request, response) => {
        const url = request.url ?? '/';

        if (url === '/' || url.startsWith('/?')) {
          response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': policy,
          });
          response.end(page);
          return;
        }

        try {
          const file = await readFile(path.join(outDir, path.basename(url)));
          response.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8',
          });
          response.end(file);
        } catch {
          response.writeHead(404).end();
        }
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

      browser = await chromium.launch({ channel: 'chrome', headless: true });
    }, 180_000);

    afterAll(async () => {
      await browser?.close();
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    });

    it('produces a real PDF under the shipped policy', async () => {
      policy = SHIPPED_POLICY;
      const page = await browser.newPage();
      await page.goto(origin, { waitUntil: 'load' });

      const result = await page.evaluate(() => window.generateInvoice());
      await page.close();

      // Named in the failure, so a regression says what the browser said.
      expect(result.ok ? '' : result.error).toBe('');
      expect(result).toMatchObject({ ok: true, head: '%PDF-' });
      expect(result.ok && result.bytes).toBeGreaterThan(1000);
    }, 120_000);

    it('still refuses eval — WebAssembly was opened, nothing else', async () => {
      policy = SHIPPED_POLICY;
      const page = await browser.newPage();
      await page.goto(origin, { waitUntil: 'load' });

      // A value read, not a call: the probe already ran as page script.
      const verdict = await page.evaluate(() => window.evalVerdict);
      await page.close();

      expect(verdict).toBe('blocked: EvalError');
    }, 60_000);

    it('fails the way it failed in production without the keyword', async () => {
      policy = POLICY_WITHOUT_WASM;
      const page = await browser.newPage();
      await page.goto(origin, { waitUntil: 'load' });

      const result = await page.evaluate(() => window.generateInvoice());
      await page.close();

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(/WebAssembly|CompileError/);
    }, 120_000);
  },
);
