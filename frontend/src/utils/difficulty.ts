/**
 * Student-friendly difficulty labels.
 *
 * Backend keeps the academic terms (EASY / MEDIUM / HARD); we rebrand them in
 * the UI to avoid discouraging students. Tutors get a key (see <DifficultyKey/>)
 * so they know exactly what's being asked of their class.
 *
 *   EASY    → 🌱 Warm-up   — build confidence, ~under 1 min/question
 *   MEDIUM  → 🎯 Core      — exam-typical, ~2 min/question
 *   HARD    → 🚀 Stretch   — push your thinking, ~3+ min/question
 */
export type DifficultyKey = 'EASY' | 'MEDIUM' | 'HARD' | 'Easy' | 'Medium' | 'Hard';

export interface DifficultyMeta {
  key: 'EASY' | 'MEDIUM' | 'HARD';
  label: string;
  icon: string;
  tutorHint: string;
  bg: string;
  fg: string;
  borderColor: string;
  className: string;   // ↔ existing CSS badge classes (bea/bme/bha)
}

const META: Record<'EASY' | 'MEDIUM' | 'HARD', DifficultyMeta> = {
  EASY: {
    key: 'EASY',
    label: 'Warm-up',
    icon: '🌱',
    tutorHint: 'Recall + 1-step questions · ≈ 45s · builds confidence',
    bg: 'rgba(34,197,94,.12)',
    fg: '#16a34a',
    borderColor: 'rgba(34,197,94,.35)',
    className: 'bea',
  },
  MEDIUM: {
    key: 'MEDIUM',
    label: 'Core',
    icon: '🎯',
    tutorHint: 'Exam-typical · 2–3 steps · ≈ 75s · the bulk of the syllabus',
    bg: 'rgba(245,158,11,.14)',
    fg: '#b45309',
    borderColor: 'rgba(245,158,11,.4)',
    className: 'bme',
  },
  HARD: {
    key: 'HARD',
    label: 'Stretch',
    icon: '🚀',
    tutorHint: 'Multi-step reasoning · ≈ 2 min+ · top distinctions',
    bg: 'rgba(168,85,247,.14)',
    fg: '#7c3aed',
    borderColor: 'rgba(168,85,247,.4)',
    className: 'bha',
  },
};

export function diffMeta(d: DifficultyKey | string | null | undefined): DifficultyMeta {
  if (!d) return META.MEDIUM;
  const upper = String(d).toUpperCase();
  return META[upper as 'EASY' | 'MEDIUM' | 'HARD'] || META.MEDIUM;
}

export function diffLabel(d: DifficultyKey | string | null | undefined): string {
  return diffMeta(d).label;
}

export function diffIcon(d: DifficultyKey | string | null | undefined): string {
  return diffMeta(d).icon;
}

export const ALL_DIFFICULTIES: DifficultyMeta[] = [META.EASY, META.MEDIUM, META.HARD];
