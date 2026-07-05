/**
 * Unit tests for the pure notification catalog + renderer: placeholder
 * substitution, HTML-escaping for email vs plain SMS, missing-var behavior,
 * placeholder extraction + subset validation, and catalog integrity.
 */
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_CATALOG,
  catalogEntry,
  extractPlaceholders,
  renderTemplate,
  unknownPlaceholders,
} from './notification-catalog';

describe('renderTemplate', () => {
  const vars = { orderNumber: 'KK-1', customerName: '<b>Ava</b>' };

  it('substitutes placeholders', () => {
    expect(renderTemplate('Order {{orderNumber}} for {{customerName}}', vars, { escapeHtml: false })).toBe(
      'Order KK-1 for <b>Ava</b>',
    );
  });

  it('HTML-escapes values for email but not for SMS', () => {
    expect(renderTemplate('{{customerName}}', vars, { escapeHtml: true })).toBe('&lt;b&gt;Ava&lt;/b&gt;');
    expect(renderTemplate('{{customerName}}', vars, { escapeHtml: false })).toBe('<b>Ava</b>');
  });

  it('renders a missing var as empty string', () => {
    expect(renderTemplate('Hi {{missing}}!', {}, { escapeHtml: false })).toBe('Hi !');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderTemplate('{{ orderNumber }}', vars, { escapeHtml: false })).toBe('KK-1');
  });
});

describe('placeholder validation', () => {
  it('extracts distinct placeholders', () => {
    expect(extractPlaceholders('{{a}} {{b}} {{a}}').sort()).toEqual(['a', 'b']);
  });

  it('flags placeholders outside the allowed set', () => {
    expect(unknownPlaceholders('{{orderNumber}} {{evil}}', ['orderNumber'])).toEqual(['evil']);
    expect(unknownPlaceholders('{{orderNumber}}', ['orderNumber', 'customerName'])).toEqual([]);
  });
});

describe('catalog integrity', () => {
  it('every default body only uses its own allowed placeholders', () => {
    for (const t of TEMPLATE_CATALOG) {
      const bad = [
        ...unknownPlaceholders(t.defaultBody, t.placeholders),
        ...(t.defaultSubject ? unknownPlaceholders(t.defaultSubject, t.placeholders) : []),
      ];
      expect({ key: t.key, channel: t.channel, bad }).toEqual({ key: t.key, channel: t.channel, bad: [] });
    }
  });

  it('email entries have a default subject; sms entries do not', () => {
    for (const t of TEMPLATE_CATALOG) {
      if (t.channel === 'email') expect(typeof t.defaultSubject).toBe('string');
      else expect(t.defaultSubject).toBeUndefined();
    }
  });

  it('catalogEntry looks up by key + channel', () => {
    expect(catalogEntry('order_shipped', 'sms')?.label).toBe('Order shipped');
    expect(catalogEntry('nope', 'email')).toBeUndefined();
  });
});
