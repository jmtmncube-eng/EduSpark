/**
 * Modular question-generator registry.
 *
 * Single source of truth for "what topics exist, what grade they belong to,
 * which diagram is relevant, and how to generate one". The rest of the app
 * (routes, seeds) talks to this registry — never to the raw `QG` map — so
 * adding a topic is a one-line change in `mathematics.ts` / `physics.ts`.
 */
import { MATHEMATICS_GENERATORS } from './mathematics';
import { PHYSICS_GENERATORS } from './physics';
import type { GeneratedQuestion, GeneratorSubject, GenDiff, TopicGenerator } from './types';

export type { TopicGenerator, GeneratorSubject, GeneratedQuestion, GenDiff } from './types';

const ALL: TopicGenerator[] = [...MATHEMATICS_GENERATORS, ...PHYSICS_GENERATORS];

// topic name → generator. Topic names are unique across subjects.
const REGISTRY = new Map<string, TopicGenerator>(ALL.map((g) => [g.topic, g]));

/** Look up a topic generator by exact topic name. */
export function getTopicGenerator(topic: string): TopicGenerator | undefined {
  return REGISTRY.get(topic);
}

/** Every registered topic generator (for admin tooling / introspection). */
export function allGenerators(): TopicGenerator[] {
  return ALL;
}

/**
 * The result of a generation: the question payload plus the resolved
 * metadata so the caller can persist diagram / CAPS / cognitive-level
 * without re-deriving anything.
 */
export interface GenerationResult {
  question: GeneratedQuestion;
  meta: TopicGenerator;
}

/**
 * Generate one question for a topic at a given difficulty. Picks a random
 * variant for variety, so a batch on the same topic isn't "same template,
 * different numbers". Falls back gracefully on an unknown topic.
 */
export function generateForTopic(
  topic: string,
  subject: string,
  _grade?: number,
  difficulty: GenDiff = 'MEDIUM',
): GenerationResult {
  let meta = REGISTRY.get(topic);
  if (!meta) {
    const subj: GeneratorSubject =
      subject === 'physical_sciences' || subject?.toLowerCase().includes('phys')
        ? 'physical_sciences'
        : 'mathematics';
    meta = ALL.find((g) => g.subject === subj) ?? ALL[0];
  }
  const variant = meta.variants[Math.floor(Math.random() * meta.variants.length)];
  return { question: variant(difficulty), meta };
}

/**
 * CAPS topic catalogue, rebuilt from the registry so it can never drift from
 * the actual generators. Shape matches the legacy `CAPS_TOPICS` export.
 */
export const CAPS_TOPICS: Record<string, Record<number, string[]>> = (() => {
  const out: Record<string, Record<number, string[]>> = {};
  for (const g of ALL) {
    for (const grade of g.grades) {
      out[g.subject] ??= {};
      out[g.subject][grade] ??= [];
      if (!out[g.subject][grade].includes(g.topic)) out[g.subject][grade].push(g.topic);
    }
  }
  return out;
})();
