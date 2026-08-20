// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WarningPanel } from '@/components/admin/warning-panel';

import { PaymentsSection, ReversePaymentForm } from '@/app/admin/(panel)/bookings/[id]/payment-forms';

/**
 * The other half of the Phase 11 regression, and the half the D1 tests cannot
 * see (§9.3, §9.4).
 *
 * `tests/payments.test.ts` proves the server gets the figures right. It passed
 * against the build the client tested, because the server *was* right: the
 * reversal recalculated, and the edit correctly refused to save and returned
 * the overpayment warning. What failed was that neither answer reached the
 * person. The warning rendered at the top of a seven-step form while the button
 * that produced it sat in the sticky bar at the bottom of a phone, and the
 * reversal's confirmation sentence was computed and discarded.
 *
 * So these tests assert the thing that actually broke: that an answer is
 * **surfaced**. A refusal nobody sees is indistinguishable from a silent save,
 * and a success nobody sees is indistinguishable from a failure.
 */

const routerRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn() }),
}));

vi.mock('@/app/admin/(panel)/bookings/[id]/payment-actions', () => ({
  recordPaymentAction: vi.fn(),
  reversePaymentAction: vi.fn(),
}));

const actions = await import(
  '@/app/admin/(panel)/bookings/[id]/payment-actions'
);
const recordPaymentAction = vi.mocked(actions.recordPaymentAction);
const reversePaymentAction = vi.mocked(actions.reversePaymentAction);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom implements neither, and `WarningPanel` calls both on mount.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('a warning has to be seen to count', () => {
  it('scrolls itself into view and takes focus on mount', () => {
    render(
      <WarningPanel
        warnings={['Paid amount exceeds the new booking value.']}
        proceedLabel="Save anyway"
        onProceed={() => undefined}
        onCancel={() => undefined}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('exceeds the new booking value');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(alert).toHaveFocus();
  });

  it('says outright that nothing was saved', () => {
    render(
      <WarningPanel
        warnings={['Something to think about.']}
        proceedLabel="Save anyway"
        onProceed={() => undefined}
        onCancel={() => undefined}
      />,
    );

    // The live failure was read as "the edit saved silently". It had not saved.
    expect(screen.getByRole('alert')).toHaveTextContent(
      /nothing has been saved yet/i,
    );
  });
});

describe('recording a payment surfaces the overpayment warning', () => {
  const renderPanel = () =>
    render(
      <PaymentsSection
        bookingId="booking-1"
        balanceDue={1_175}
        methods={[{ id: 'm1', name: 'Cash' }]}
        today="2026-08-20"
        canRecord
      >
        <div>history</div>
      </PaymentsSection>,
    );

  it('shows the warning, relabels the button, and writes nothing until it is acknowledged', async () => {
    const user = userEvent.setup();

    recordPaymentAction.mockResolvedValueOnce({
      ok: false,
      kind: 'confirm',
      warnings: ['That is more than the balance due (SAR 1,175).'],
    });

    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await user.type(screen.getByLabelText(/Amount/), '2000');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('more than the balance due');

    // The plain "Record payment" submit is replaced, so acknowledging is a
    // different act from the tap that raised the warning.
    expect(
      screen.getByRole('button', { name: 'Record it anyway' }),
    ).toBeInTheDocument();
    expect(recordPaymentAction).toHaveBeenCalledTimes(1);
    expect(recordPaymentAction.mock.calls[0][0].acknowledged).toBe(false);

    recordPaymentAction.mockResolvedValueOnce({
      ok: true,
      message: 'Payment recorded. The booking is overpaid by SAR 825.',
    });

    await user.click(screen.getByRole('button', { name: 'Record it anyway' }));

    await waitFor(() => {
      expect(recordPaymentAction).toHaveBeenCalledTimes(2);
    });
    expect(recordPaymentAction.mock.calls[1][0].acknowledged).toBe(true);

    // And the answer is on screen, not only in the response.
    expect(await screen.findByRole('status')).toHaveTextContent(
      /overpaid by SAR 825/,
    );
    expect(routerRefresh).toHaveBeenCalled();
  });
});

describe('reversing a payment says what it did', () => {
  it('surfaces the new paid figure, from a component that unmounts itself', async () => {
    const user = userEvent.setup();

    reversePaymentAction.mockResolvedValueOnce({
      ok: true,
      message: 'Payment reversed. Paid is now SAR 1,175.',
    });

    render(
      <PaymentsSection
        bookingId="booking-1"
        balanceDue={0}
        methods={[]}
        today="2026-08-20"
        canRecord={false}
      >
        <ReversePaymentForm paymentId="payment-1" amount={500} />
      </PaymentsSection>,
    );

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    await user.type(
      screen.getByLabelText(/being reversed/i),
      'Sent in error, refunded',
    );
    await user.click(screen.getByRole('button', { name: 'Reverse it' }));

    // The confirmation belongs to the section, not to the form — the form is
    // gone as soon as the refresh marks the row reversed.
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Payment reversed. Paid is now SAR 1,175.',
    );
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('keeps the reason on screen when the action refuses', async () => {
    const user = userEvent.setup();

    reversePaymentAction.mockResolvedValueOnce({
      ok: false,
      kind: 'error',
      message: 'You do not have permission to do that.',
    });

    render(
      <PaymentsSection
        bookingId="booking-1"
        balanceDue={0}
        methods={[]}
        today="2026-08-20"
        canRecord={false}
      >
        <ReversePaymentForm paymentId="payment-1" amount={500} />
      </PaymentsSection>,
    );

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    const reason = screen.getByLabelText(/being reversed/i);
    await user.type(reason, 'Refunded by transfer');
    await user.click(screen.getByRole('button', { name: 'Reverse it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/permission/i);
    // Typed text survives a refusal — the whole reason these forms are
    // controlled rather than plain posts.
    expect(reason).toHaveValue('Refunded by transfer');
  });
});
