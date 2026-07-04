/**
 * Unit tests for the payment provider refund contract (cancel-order refund
 * execution). The MockPaymentProvider drives the keyless local refund path that
 * cancel.ts uses when no RAZORPAY_KEY_ID is set — so these guard the exact shape
 * cancel.ts depends on: a `rfnd_…` id + a `processed | pending | failed` status,
 * and a hard reject on a non-positive amount (a caller bug).
 */
import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from '@kakoa/integrations';

describe('MockPaymentProvider.refund', () => {
  const provider = new MockPaymentProvider();

  it('returns a rfnd_mock_ id and a processed status for a valid refund', async () => {
    const result = await provider.refund({
      providerPaymentId: 'pay_mock_abc123',
      amountPaise: 91_800,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      notes: { order_number: 'KK-48213', reason: 'order_cancelled' },
    });
    expect(result.providerRefundId).toMatch(/^rfnd_mock_[0-9a-f]{8}$/);
    expect(result.status).toBe('processed');
  });

  it('mints a distinct refund id per call', async () => {
    const a = await provider.refund({
      providerPaymentId: 'pay_mock_a',
      amountPaise: 100,
      idempotencyKey: 'k1',
    });
    const b = await provider.refund({
      providerPaymentId: 'pay_mock_b',
      amountPaise: 100,
      idempotencyKey: 'k2',
    });
    expect(a.providerRefundId).not.toBe(b.providerRefundId);
  });

  it.each([0, -1, -50_000, 1.5, Number.NaN])(
    'throws on a non-positive / non-integer amount (%s)',
    async (amountPaise) => {
      await expect(
        provider.refund({
          providerPaymentId: 'pay_mock_x',
          amountPaise,
          idempotencyKey: 'k',
        }),
      ).rejects.toThrow();
    },
  );

  it('satisfies the PaymentProvider refund signature (full amount)', async () => {
    const result = await provider.refund({
      providerPaymentId: 'pay_mock_full',
      amountPaise: 52_300,
      idempotencyKey: 'refund-uuid',
    });
    // status is one of the three contract values
    expect(['processed', 'pending', 'failed']).toContain(result.status);
  });
});
