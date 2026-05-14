import { describe, it, expect } from 'vitest';
import { validateQuestion } from '../utils/questionValidation';

describe('validateQuestion', () => {
  const good = {
    question: 'Solve for x: 2x + 3 = 9',
    options: ['x = 3', 'x = 2', 'x = 4', 'x = 6'],
    answer: 'x = 3',
    solution: 'Step 1: 2x = 6\nStep 2: x = 3',
    topic: 'Algebra',
    subject: 'mathematics',
  };

  it('passes a well-formed question', () => {
    const r = validateQuestion(good);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('flags an empty question', () => {
    const r = validateQuestion({ ...good, question: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/empty/i);
  });

  it('flags a missing topic', () => {
    const r = validateQuestion({ ...good, topic: '' });
    expect(r.ok).toBe(false);
  });

  it('flags fewer than 2 options', () => {
    const r = validateQuestion({ ...good, options: ['x = 3'] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at least 2/i);
  });

  it('flags duplicate options', () => {
    const r = validateQuestion({ ...good, options: ['x = 3', 'x = 3', 'x = 4', 'x = 6'] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('flags an answer that is not among the options — the core GIGO check', () => {
    const r = validateQuestion({ ...good, answer: 'x = 99' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/does not exactly match/i);
  });

  it('accepts an answer that matches an option ignoring case/spacing/★', () => {
    const r = validateQuestion({ ...good, answer: '  X = 3 ', options: ['★ x = 3', 'x = 2', 'x = 4', 'x = 6'] });
    expect(r.ok).toBe(true);
  });

  it('warns (but does not block) when the worked solution is missing', () => {
    const r = validateQuestion({ ...good, solution: '' });
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
