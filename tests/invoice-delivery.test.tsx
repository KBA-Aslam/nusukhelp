// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InvoiceDownload } from '@/app/admin/(panel)/bookings/[id]/invoice-download';
import type { InvoiceSource } from '@/lib/pdf/types';

import { FULL } from './helpers/invoice-fixture';

/**
 * The half of §10 that the text-layer tests cannot see: **which document the
 * person is holding**.
 *
 * `tests/invoice-pdf.test.tsx` proves the confidential PDF carries no amounts.
 * That is worth nothing if someone taps *Confidential*, gets the full invoice
 * — or gets nothing, or gets something that failed halfway — and shares it
 * believing otherwise. The filename says which style it is, and nobody reads a
 * filename on a phone before hitting share.
 *
 * So these tests assert the answer reaches the person: that the style is named
 * in words after the fact, that it is announced and scrolled to, that a stale
 * answer is cleared the moment the selection changes, and that a failure says
 * outright that nothing was produced.
 */

const toBlob = vi.fn(async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' }));

vi.mock('@react-pdf/renderer', () => ({
  // The document modules build their stylesheet at import time.
  StyleSheet: { create: (sheet: unknown) => sheet },
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  Image: () => null,
  pdf: () => ({ toBlob }),
}));

const SOURCE: InvoiceSource = (() => {
  // Everything the server hands down, which is the full invoice minus its
  // timestamp — the browser stamps that at the tap.
  const source: Record<string, unknown> = { ...FULL };
  delete source.generatedAt;
  return source as unknown as InvoiceSource;
})();

beforeEach(() => {
  vi.clearAllMocks();
  toBlob.mockImplementation(
    async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
  );
  // jsdom implements none of these, and the ready panel calls all three.
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:invoice');
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe('the style is chosen explicitly, every time (§10)', () => {
  it('offers no default and refuses to generate until one is picked', () => {
    render(<InvoiceDownload source={SOURCE} />);

    expect(screen.getByLabelText(/Full invoice/)).not.toBeChecked();
    expect(screen.getByLabelText(/Confidential invoice/)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  });
});

describe('what was produced is said out loud, after the fact', () => {
  it('names the confidential style and its filename, and announces it', async () => {
    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Confidential invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Confidential invoice ready');
    expect(status).toHaveTextContent('no amounts in it');
    expect(status).toHaveTextContent('AHR-2026-00041-confidential.pdf');
    expect(status).toHaveTextContent('Statement as of');

    // Announced, focused, and brought to where the person is looking.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(status).toHaveFocus();
  });

  it('names the full style, and warns what is in it', async () => {
    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Full invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Full invoice ready');
    expect(status).toHaveTextContent('every amount is in it');
    expect(status).toHaveTextContent('Do not send this to an end client');
    expect(status).toHaveTextContent('AHR-2026-00041.pdf');
    expect(status).not.toHaveTextContent('confidential.pdf');
  });

  it('clears a stale answer as soon as the selection changes', async () => {
    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Confidential invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Confidential invoice ready',
    );

    // A "Confidential ready" line sitting above a newly selected Full radio is
    // exactly how the wrong document gets shared.
    await user.click(screen.getByLabelText(/Full invoice/));

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});

describe('failures are visible, and never fall back to the other style', () => {
  it('says nothing was produced', async () => {
    toBlob.mockRejectedValueOnce(new Error('font could not be loaded'));

    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Confidential invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('could not be produced');
    expect(alert).toHaveTextContent('Nothing was downloaded');

    // No ready panel, so nothing can be shared under a wrong label.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Save PDF' })).not.toBeInTheDocument();
  });
});

describe('delivery (§20.2)', () => {
  it('falls back to a download link where sharing is unsupported', async () => {
    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Confidential invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByRole('status');

    const link = screen.getByRole('link', { name: 'Save PDF' });
    expect(link).toHaveAttribute('download', 'AHR-2026-00041-confidential.pdf');
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('shares the file itself where the browser supports it', async () => {
    const share = vi.fn(async () => undefined);
    Object.assign(navigator, { share, canShare: () => true });

    const user = userEvent.setup();
    render(<InvoiceDownload source={SOURCE} />);

    await user.click(screen.getByLabelText(/Confidential invoice/));
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByRole('status');

    // A second, separate tap: the sentence is read first, and `navigator.share`
    // stays inside its own user gesture, which iOS Safari requires.
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(share).toHaveBeenCalledTimes(1);
    const [payload] = share.mock.calls[0] as unknown as [
      { files: File[]; title: string },
    ];
    expect(payload.files[0].name).toBe('AHR-2026-00041-confidential.pdf');
    expect(payload.files[0].type).toBe('application/pdf');
  });
});
