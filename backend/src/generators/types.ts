import type { GeneratedQuestion, GeneratorFn } from '../utils/questionGenerators';
import type { DiagramKind } from '../utils/diagramTemplates';

export type { GeneratedQuestion, GeneratorFn, DiagramKind };

export type GeneratorSubject = 'mathematics' | 'physical_sciences';

/**
 * One self-describing topic generator. This is the unit of modularity:
 * to add or tune a topic you add/edit one of these objects in
 * `mathematics.ts` or `physics.ts` — nothing else in the app changes.
 *
 *   diagram  — the ONE diagram kind genuinely relevant to this topic, or
 *              `null` when no diagram helps (we attach nothing rather than a
 *              misleading picture). This is the v2.9 "smarter diagrams" fix.
 *   caps     — internal CAPS curriculum index (e.g. "M10-01"), lets analytics
 *              slice performance by curriculum strand.
 *   cognitiveLevel — CAPS cognitive level 1-4 the generator typically produces
 *              (1 Knowledge · 2 Routine · 3 Complex · 4 Problem-solving).
 */
export interface TopicGenerator {
  topic: string;
  subject: GeneratorSubject;
  grades: number[];
  diagram: DiagramKind | null;
  caps: string;
  cognitiveLevel: number;
  generate: GeneratorFn;
}
