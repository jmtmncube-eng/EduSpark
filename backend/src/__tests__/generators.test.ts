import { describe, it, expect } from 'vitest';
import { allGenerators, generateForTopic, CAPS_TOPICS } from '../generators';
import { validateQuestion } from '../utils/questionValidation';
import type { GenDiff } from '../utils/questionGenerators';

const DIFFICULTIES: GenDiff[] = ['EASY', 'MEDIUM', 'HARD'];
const RUNS = 8; // each variant is random — run it several times

const norm = (s: string) => s.replace(/^★\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();

describe('question generators — every topic, every variant, every difficulty', () => {
  for (const g of allGenerators()) {
    describe(g.topic, () => {
      g.variants.forEach((variant, vi) => {
        for (const diff of DIFFICULTIES) {
          it(`variant ${vi + 1} @ ${diff} always produces a valid question`, () => {
            for (let run = 0; run < RUNS; run++) {
              const q = variant(diff);

              // Shape
              expect(q.q.trim().length, `${g.topic} v${vi + 1} ${diff}: empty question`).toBeGreaterThan(0);
              expect(q.opts.length, `${g.topic} v${vi + 1} ${diff}: needs ≥2 options`).toBeGreaterThanOrEqual(2);
              expect(q.sol.trim().length, `${g.topic} v${vi + 1} ${diff}: empty solution`).toBeGreaterThan(0);

              // Options are distinct
              const keys = q.opts.map(norm);
              expect(new Set(keys).size, `${g.topic} v${vi + 1} ${diff}: duplicate options [${q.opts.join(' | ')}]`).toBe(keys.length);

              // The correct answer is one of the options — the core GIGO guarantee
              expect(keys.includes(norm(q.ans)), `${g.topic} v${vi + 1} ${diff}: answer "${q.ans}" not in options [${q.opts.join(' | ')}]`).toBe(true);

              // The validation pipeline agrees it's clean
              const errors = validateQuestion({
                question: q.q, options: q.opts, answer: q.ans, solution: q.sol,
                topic: g.topic, subject: g.subject,
              }).errors;
              expect(errors, `${g.topic} v${vi + 1} ${diff}: validation errors → ${errors.join('; ')}`).toHaveLength(0);

              // Difficulty label is honoured
              expect(['Easy', 'Medium', 'Hard']).toContain(q.diff);
            }
          });
        }
      });
    });
  }
});

describe('generator registry', () => {
  it('covers every CAPS topic for both subjects, Grades 10-12', () => {
    for (const subject of ['mathematics', 'physical_sciences']) {
      for (const grade of [10, 11, 12]) {
        const topics = CAPS_TOPICS[subject]?.[grade] || [];
        expect(topics.length, `${subject} Gr${grade} has no topics`).toBeGreaterThanOrEqual(6);
        for (const topic of topics) {
          const { question, meta } = generateForTopic(topic, subject, grade, 'MEDIUM');
          expect(meta.topic).toBe(topic);
          expect(question.q.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('falls back gracefully on an unknown topic', () => {
    const { question } = generateForTopic('Totally Made Up Topic', 'mathematics', 11, 'EASY');
    expect(question.q.trim().length).toBeGreaterThan(0);
  });
});
