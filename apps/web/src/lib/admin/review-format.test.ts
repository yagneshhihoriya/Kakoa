import { describe, expect, it } from 'vitest';
import { displayReviewerName, validateModerationInput } from './review-format';

describe('displayReviewerName', () => {
  it('shows first name + last initial', () => {
    expect(displayReviewerName('John Doe')).toBe('John D.');
    expect(displayReviewerName('Priya Kumari Sharma')).toBe('Priya S.');
  });

  it('leaves a single name unchanged', () => {
    expect(displayReviewerName('Aarav')).toBe('Aarav');
  });

  it('collapses extra whitespace', () => {
    expect(displayReviewerName('  John   Doe  ')).toBe('John D.');
  });

  it('falls back to Anonymous for null / blank', () => {
    expect(displayReviewerName(null)).toBe('Anonymous');
    expect(displayReviewerName(undefined)).toBe('Anonymous');
    expect(displayReviewerName('   ')).toBe('Anonymous');
  });
});

describe('validateModerationInput', () => {
  it('accepts approved / rejected with no note', () => {
    expect(validateModerationInput({ decision: 'approved' })).toEqual({
      ok: true,
      value: { decision: 'approved', note: null },
    });
    expect(validateModerationInput({ decision: 'rejected' })).toEqual({
      ok: true,
      value: { decision: 'rejected', note: null },
    });
  });

  it('trims a note and keeps it', () => {
    const r = validateModerationInput({ decision: 'rejected', note: '  spammy  ' });
    expect(r.ok && r.value.note).toBe('spammy');
  });

  it('rejects an unknown decision', () => {
    expect(validateModerationInput({ decision: 'maybe' }).ok).toBe(false);
    expect(validateModerationInput({}).ok).toBe(false);
    expect(validateModerationInput(null).ok).toBe(false);
  });

  it('rejects a note over 500 chars', () => {
    expect(validateModerationInput({ decision: 'approved', note: 'x'.repeat(501) }).ok).toBe(false);
    expect(validateModerationInput({ decision: 'approved', note: 'x'.repeat(500) }).ok).toBe(true);
  });

  it('treats an empty-string note as no note', () => {
    const r = validateModerationInput({ decision: 'approved', note: '' });
    expect(r.ok && r.value.note).toBeNull();
  });
});
