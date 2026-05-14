/**
 * Question quality scoring — turns raw usage stats into an actionable flag.
 *
 * GIGO defence after the question is live: even a question that passed
 * validation can turn out to be bad once students attempt it. These flags
 * surface those questions so a human can fix or retire them.
 *
 *   broken             — almost nobody gets it right → answer key likely wrong
 *   trivial            — almost everybody gets it → carries no assessment value
 *   low_discrimination — strong and weak students score the same → doesn't
 *                        distinguish ability (the single best "bad question" signal)
 *   no_attempts        — never been used; not bad, just unproven
 *   null               — healthy
 */

export interface QuestionStatInput {
  attempts: number;
  correctRate: number;       // 0-100
  discrimination: number;    // -100..100  (top-half correctRate − bottom-half correctRate)
}

export type QualityFlag = 'broken' | 'trivial' | 'low_discrimination' | 'no_attempts' | null;

// Thresholds — tuned conservatively so we only flag with enough evidence.
const MIN_ATTEMPTS_QUALITY = 8;     // need this many before "broken/trivial"
const MIN_ATTEMPTS_DISCRIM = 12;    // discrimination needs more data to be meaningful
const BROKEN_RATE = 20;             // correctRate below this → likely broken
const TRIVIAL_RATE = 97;            // correctRate above this → trivial
const LOW_DISCRIM = 10;             // |discrimination| below this → doesn't separate ability

export function computeQualityFlag(s: QuestionStatInput): QualityFlag {
  if (s.attempts === 0) return 'no_attempts';
  if (s.attempts >= MIN_ATTEMPTS_QUALITY) {
    if (s.correctRate < BROKEN_RATE) return 'broken';
    if (s.correctRate > TRIVIAL_RATE) return 'trivial';
  }
  if (s.attempts >= MIN_ATTEMPTS_DISCRIM && Math.abs(s.discrimination) < LOW_DISCRIM) {
    return 'low_discrimination';
  }
  return null;
}

/** Human-readable label + tone for a flag, for UI rendering. */
export const QUALITY_FLAG_META: Record<Exclude<QualityFlag, null>, { label: string; tone: 'bad' | 'warn' | 'info'; hint: string }> = {
  broken:             { label: '🛑 Likely broken',        tone: 'bad',  hint: 'Almost no student gets this right — check the answer key.' },
  trivial:            { label: '😴 Too easy',             tone: 'warn', hint: 'Nearly everyone gets it — adds little assessment value.' },
  low_discrimination: { label: '⚖️ Low discrimination',   tone: 'warn', hint: 'Strong and weak students score the same — it does not distinguish ability.' },
  no_attempts:        { label: '🆕 Unproven',             tone: 'info', hint: 'Never attempted yet — quality unknown.' },
};
