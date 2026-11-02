/**
 * The From header the Resend provider sends: `"Name" <address>` from the
 * brand's display name, overridden per deployment by EMAIL_FROM_NAME, else the
 * bare address. Header-breaking characters never survive.
 */
import { describe, expect, it } from 'vitest';
import { composeFrom } from '@kakoa/integrations';

describe('composeFrom', () => {
  it("uses the caller's (brand) name when no env override is set", () => {
    expect(composeFrom('orders@example.com', 'KAKOA', undefined)).toBe('"KAKOA" <orders@example.com>');
  });

  it('EMAIL_FROM_NAME wins over the brand name', () => {
    expect(composeFrom('orders@example.com', 'KAKOA', 'KAKOA Orders')).toBe(
      '"KAKOA Orders" <orders@example.com>',
    );
  });

  it('falls back to the bare address when there is no name at all', () => {
    expect(composeFrom('orders@example.com', undefined, undefined)).toBe('orders@example.com');
    expect(composeFrom('orders@example.com', '   ', undefined)).toBe('orders@example.com');
  });

  it('strips header-breaking characters from the display name', () => {
    expect(composeFrom('orders@example.com', 'Evil"\r\nBcc: x <y>', undefined)).toBe(
      '"EvilBcc: x y" <orders@example.com>',
    );
  });
});
