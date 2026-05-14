import { QG } from '../utils/questionGenerators';
import type { TopicGenerator } from './types';

/**
 * Mathematics topic generators — one entry per CAPS topic, Grades 10-12.
 *
 * The generation maths lives in `utils/questionGenerators.ts` (the `QG` map);
 * this module is the *registry* — it pairs each topic with its metadata:
 * which grades it belongs to, the genuinely-relevant diagram kind (or null),
 * its CAPS index, and the cognitive level it typically produces.
 */
export const MATHEMATICS_GENERATORS: TopicGenerator[] = [
  // ─── Grade 10 ────────────────────────────────────────────────────
  { topic: 'Algebra',             subject: 'mathematics', grades: [10], diagram: null,         caps: 'M10-01', cognitiveLevel: 2, generate: QG['Algebra'] },
  { topic: 'Functions & Graphs',  subject: 'mathematics', grades: [10], diagram: 'parabola',   caps: 'M10-02', cognitiveLevel: 2, generate: QG['Functions & Graphs'] },
  { topic: 'Trigonometry',        subject: 'mathematics', grades: [10], diagram: 'triangle',   caps: 'M10-03', cognitiveLevel: 2, generate: QG['Trigonometry'] },
  { topic: 'Statistics',          subject: 'mathematics', grades: [10], diagram: 'bar-chart',  caps: 'M10-04', cognitiveLevel: 1, generate: QG['Statistics'] },
  { topic: 'Finance & Growth',    subject: 'mathematics', grades: [10], diagram: null,         caps: 'M10-05', cognitiveLevel: 3, generate: QG['Finance & Growth'] },
  { topic: 'Euclidean Geometry',  subject: 'mathematics', grades: [10], diagram: 'triangle',   caps: 'M10-06', cognitiveLevel: 2, generate: QG['Euclidean Geometry'] },

  // ─── Grade 11 ────────────────────────────────────────────────────
  { topic: 'Quadratic Equations',     subject: 'mathematics', grades: [11], diagram: 'parabola',   caps: 'M11-01', cognitiveLevel: 2, generate: QG['Quadratic Equations'] },
  { topic: 'Trigonometric Functions', subject: 'mathematics', grades: [11], diagram: 'triangle',   caps: 'M11-02', cognitiveLevel: 2, generate: QG['Trigonometric Functions'] },
  { topic: 'Analytical Geometry',     subject: 'mathematics', grades: [11], diagram: 'coord-grid', caps: 'M11-03', cognitiveLevel: 3, generate: QG['Analytical Geometry'] },
  { topic: 'Finance',                 subject: 'mathematics', grades: [11], diagram: null,         caps: 'M11-04', cognitiveLevel: 2, generate: QG['Finance'] },
  { topic: 'Counting & Probability',  subject: 'mathematics', grades: [11], diagram: null,         caps: 'M11-05', cognitiveLevel: 3, generate: QG['Counting & Probability'] },
  { topic: 'Inequalities',            subject: 'mathematics', grades: [11], diagram: null,         caps: 'M11-06', cognitiveLevel: 2, generate: QG['Inequalities'] },

  // ─── Grade 12 ────────────────────────────────────────────────────
  { topic: 'Differential Calculus',     subject: 'mathematics', grades: [12], diagram: 'parabola',   caps: 'M12-01', cognitiveLevel: 3, generate: QG['Differential Calculus'] },
  { topic: 'Sequences & Series',        subject: 'mathematics', grades: [12], diagram: null,         caps: 'M12-02', cognitiveLevel: 3, generate: QG['Sequences & Series'] },
  { topic: 'Polynomials',               subject: 'mathematics', grades: [12], diagram: 'parabola',   caps: 'M12-03', cognitiveLevel: 3, generate: QG['Polynomials'] },
  { topic: 'Exponential & Logarithms',  subject: 'mathematics', grades: [12], diagram: null,         caps: 'M12-04', cognitiveLevel: 2, generate: QG['Exponential & Logarithms'] },
  { topic: 'Regression Analysis',       subject: 'mathematics', grades: [12], diagram: 'coord-grid', caps: 'M12-05', cognitiveLevel: 2, generate: QG['Regression Analysis'] },
  { topic: 'Trigonometry Advanced',     subject: 'mathematics', grades: [12], diagram: 'triangle',   caps: 'M12-06', cognitiveLevel: 3, generate: QG['Trigonometry Advanced'] },
];
