import type { QuestionStatus } from '../types';

/**
 * Shared visual metadata for the v2.9 quality pipeline — review status and
 * the auto-computed quality flag. Used by the Question Bank, the generator
 * panel, and the batch viewer so the language/colour stays consistent.
 */

export interface Chip {
  label: string;
  icon: string;
  fg: string;
  bg: string;
  border: string;
  hint: string;
}

export const STATUS_META: Record<QuestionStatus, Chip> = {
  DRAFT: {
    label: 'Draft', icon: '✏️',
    fg: '#64748b', bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.35)',
    hint: 'Not yet checked. Has blocking validation errors or is still being written.',
  },
  REVIEW: {
    label: 'In review', icon: '🔍',
    fg: '#b45309', bg: 'rgba(180,83,9,.12)', border: 'rgba(180,83,9,.35)',
    hint: 'Generated or imported in bulk — needs a human sign-off before it can reach students.',
  },
  PUBLISHED: {
    label: 'Published', icon: '✅',
    fg: '#15803d', bg: 'rgba(21,128,61,.12)', border: 'rgba(21,128,61,.35)',
    hint: 'Validated and approved — eligible to be bundled into Packs and Assignments.',
  },
  RETIRED: {
    label: 'Retired', icon: '📦',
    fg: '#64748b', bg: 'rgba(100,116,139,.10)', border: 'rgba(100,116,139,.30)',
    hint: 'Pulled from circulation. Kept only so historical results still resolve.',
  },
};

export type QualityFlagKey = 'broken' | 'trivial' | 'low_discrimination' | 'no_attempts';

export const QUALITY_META: Record<QualityFlagKey, Chip> = {
  broken: {
    label: 'Likely broken', icon: '🛑',
    fg: '#b91c1c', bg: 'rgba(185,28,28,.12)', border: 'rgba(185,28,28,.4)',
    hint: 'Almost no student gets this right — the answer key is probably wrong.',
  },
  trivial: {
    label: 'Too easy', icon: '😴',
    fg: '#b45309', bg: 'rgba(180,83,9,.12)', border: 'rgba(180,83,9,.35)',
    hint: 'Nearly everyone gets it — it adds little assessment value.',
  },
  low_discrimination: {
    label: 'Low discrimination', icon: '⚖️',
    fg: '#b45309', bg: 'rgba(180,83,9,.12)', border: 'rgba(180,83,9,.35)',
    hint: 'Strong and weak students score the same — it does not distinguish ability.',
  },
  no_attempts: {
    label: 'Unproven', icon: '🆕',
    fg: '#0369a1', bg: 'rgba(3,105,161,.10)', border: 'rgba(3,105,161,.3)',
    hint: 'Never attempted yet — quality is unknown until students use it.',
  },
};

/** CAPS cognitive levels 1-4, with the official CAPS descriptors. */
export const COGNITIVE_LEVELS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: 'L1 · Knowledge',        hint: 'Straight recall — definitions, facts, reading off a graph.' },
  { value: 2, label: 'L2 · Routine',          hint: 'Routine procedure — a familiar 1-2 step calculation.' },
  { value: 3, label: 'L3 · Complex',          hint: 'Complex procedure — multi-step, requires a plan.' },
  { value: 4, label: 'L4 · Problem-solving',  hint: 'Unseen problem-solving — non-routine reasoning.' },
];

export function statusMeta(status?: string | null): Chip {
  return STATUS_META[(status as QuestionStatus)] ?? STATUS_META.DRAFT;
}

export function qualityMeta(flag?: string | null): Chip | null {
  if (!flag) return null;
  return QUALITY_META[flag as QualityFlagKey] ?? null;
}
