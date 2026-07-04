/**
 * Pure review helpers — NO @kakoa/db import, so they're unit-testable and the
 * single source of truth for reviewer-name display (reviewers are semi-public,
 * so we show a first name + last initial and never any contact) and moderation
 * input validation (decision ∈ {approved,rejected}, note ≤ 500 chars).
 */
import type { ReviewStatus } from '@kakoa/core';

/**
 * Display name for a reviewer: first name + last initial (`"John Doe"` →
 * `"John D."`), a single name unchanged, and `"Anonymous"` when the customer
 * has no name. Never exposes contact details.
 */
export function displayReviewerName(name: string | null | undefined): string {
  if (name == null) return 'Anonymous';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (first === undefined) return 'Anonymous';
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1];
  const initial = last ? last.slice(0, 1).toUpperCase() : '';
  return initial ? `${first} ${initial}.` : first;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export interface ModerationValues {
  decision: 'approved' | 'rejected';
  note: string | null;
}

export type ModerationValidation =
  | { ok: true; value: ModerationValues }
  | { ok: false; message: string };

/** Validate a moderation payload: decision required, optional note ≤ 500 chars. */
export function validateModerationInput(raw: unknown): ModerationValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid moderation payload.' };
  }
  const b = raw as Record<string, unknown>;
  if (b.decision !== 'approved' && b.decision !== 'rejected') {
    return { ok: false, message: 'Choose to approve or reject.' };
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null && b.note !== '') {
    if (typeof b.note !== 'string') return { ok: false, message: 'Invalid moderation note.' };
    const t = b.note.trim();
    if (t.length > 500) {
      return { ok: false, message: 'Moderation note must be 500 characters or fewer.' };
    }
    note = t === '' ? null : t;
  }
  return { ok: true, value: { decision: b.decision, note } };
}
