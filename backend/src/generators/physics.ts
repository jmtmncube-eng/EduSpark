import { QG } from '../utils/questionGenerators';
import type { TopicGenerator } from './types';

/**
 * Physical Sciences topic generators — one entry per CAPS topic, Grades 10-12.
 *
 * The generation maths lives in `utils/questionGenerators.ts` (the `QG` map);
 * this module is the *registry* — it pairs each topic with its metadata.
 */
export const PHYSICS_GENERATORS: TopicGenerator[] = [
  // ─── Grade 10 ────────────────────────────────────────────────────
  { topic: "Newton's Laws",           subject: 'physical_sciences', grades: [10], diagram: 'incline', caps: 'P10-01', cognitiveLevel: 2, variants: QG["Newton's Laws"] },
  { topic: 'Momentum',                subject: 'physical_sciences', grades: [10], diagram: 'vector',  caps: 'P10-02', cognitiveLevel: 2, variants: QG['Momentum'] },
  { topic: 'Energy & Power',          subject: 'physical_sciences', grades: [10], diagram: null,      caps: 'P10-03', cognitiveLevel: 2, variants: QG['Energy & Power'] },
  { topic: 'Waves & Sound',           subject: 'physical_sciences', grades: [10], diagram: 'wave',    caps: 'P10-04', cognitiveLevel: 2, variants: QG['Waves & Sound'] },
  { topic: 'Electricity & Magnetism', subject: 'physical_sciences', grades: [10], diagram: 'circuit', caps: 'P10-05', cognitiveLevel: 2, variants: QG['Electricity & Magnetism'] },
  { topic: 'Chemistry: Matter',       subject: 'physical_sciences', grades: [10], diagram: null,      caps: 'P10-06', cognitiveLevel: 1, variants: QG['Chemistry: Matter'] },

  // ─── Grade 11 ────────────────────────────────────────────────────
  { topic: 'Projectile Motion',       subject: 'physical_sciences', grades: [11], diagram: 'projectile', caps: 'P11-01', cognitiveLevel: 3, variants: QG['Projectile Motion'] },
  { topic: 'Electrostatics',          subject: 'physical_sciences', grades: [11], diagram: 'vector',     caps: 'P11-02', cognitiveLevel: 3, variants: QG['Electrostatics'] },
  { topic: 'Electric Circuits',       subject: 'physical_sciences', grades: [11], diagram: 'circuit',    caps: 'P11-03', cognitiveLevel: 2, variants: QG['Electric Circuits'] },
  { topic: 'Intermolecular Forces',   subject: 'physical_sciences', grades: [11], diagram: null,         caps: 'P11-04', cognitiveLevel: 1, variants: QG['Intermolecular Forces'] },
  { topic: 'Chemical Equilibrium',    subject: 'physical_sciences', grades: [11], diagram: null,         caps: 'P11-05', cognitiveLevel: 3, variants: QG['Chemical Equilibrium'] },
  { topic: 'Vectors & Scalars',       subject: 'physical_sciences', grades: [11], diagram: 'vector',     caps: 'P11-06', cognitiveLevel: 2, variants: QG['Vectors & Scalars'] },

  // ─── Grade 12 ────────────────────────────────────────────────────
  { topic: 'Momentum & Impulse',          subject: 'physical_sciences', grades: [12], diagram: 'vector',     caps: 'P12-01', cognitiveLevel: 3, variants: QG['Momentum & Impulse'] },
  { topic: 'Vertical Projectile Motion',  subject: 'physical_sciences', grades: [12], diagram: 'projectile', caps: 'P12-02', cognitiveLevel: 3, variants: QG['Vertical Projectile Motion'] },
  { topic: 'Electrodynamics',             subject: 'physical_sciences', grades: [12], diagram: 'circuit',    caps: 'P12-03', cognitiveLevel: 3, variants: QG['Electrodynamics'] },
  { topic: 'Organic Chemistry',           subject: 'physical_sciences', grades: [12], diagram: null,         caps: 'P12-04', cognitiveLevel: 2, variants: QG['Organic Chemistry'] },
  { topic: 'Electrochemistry',            subject: 'physical_sciences', grades: [12], diagram: null,         caps: 'P12-05', cognitiveLevel: 3, variants: QG['Electrochemistry'] },
  { topic: 'Optical Phenomena',           subject: 'physical_sciences', grades: [12], diagram: 'wave',       caps: 'P12-06', cognitiveLevel: 2, variants: QG['Optical Phenomena'] },
];
