/**
 * Pre-defined Pack templates. Each describes the difficulty mix + question
 * count so the route can auto-generate the questions and assemble the pack.
 */
export type PackTemplateId = 'friday-diagnostic' | 'weekly-review' | 'exam-prep' | 'quick-check';

export interface PackTemplate {
  id: PackTemplateId;
  title: string;
  description: string;
  emoji: string;
  /** target distribution: { difficulty → count } */
  mix: { EASY: number; MEDIUM: number; HARD: number };
}

export const PACK_TEMPLATES: PackTemplate[] = [
  {
    id: 'quick-check',
    title: 'Quick Check',
    description: '5 questions, mostly warm-up — under 10 minutes.',
    emoji: '⚡',
    mix: { EASY: 3, MEDIUM: 2, HARD: 0 },
  },
  {
    id: 'friday-diagnostic',
    title: 'Friday Diagnostic',
    description: '10 questions across all levels — see exactly where the class stands.',
    emoji: '🔬',
    mix: { EASY: 3, MEDIUM: 4, HARD: 3 },
  },
  {
    id: 'weekly-review',
    title: 'Weekly Review',
    description: '12 questions of core practice with light stretch — 25 min.',
    emoji: '📚',
    mix: { EASY: 2, MEDIUM: 8, HARD: 2 },
  },
  {
    id: 'exam-prep',
    title: 'Exam Prep',
    description: '20 questions — heavier on stretch, exam-style intensity.',
    emoji: '🎯',
    mix: { EASY: 2, MEDIUM: 10, HARD: 8 },
  },
];

export function getTemplate(id: string): PackTemplate | null {
  return PACK_TEMPLATES.find((t) => t.id === id) ?? null;
}
