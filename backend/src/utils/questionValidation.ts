/**
 * Question validation pipeline.
 *
 * Every question — generated, imported, or hand-written — passes through
 * `validateQuestion()` before it can be PUBLISHED. The goal is GIGO defence:
 * a question with a wrong/ambiguous answer or empty solution should never
 * reach a student.
 *
 *   errors   → blocking. A question with errors cannot move to PUBLISHED.
 *   warnings → non-blocking. Surfaced in the UI so a human can decide.
 */

export interface QuestionInput {
  question?: string | null;
  options?: string[] | null;
  answer?: string | null;
  solution?: string | null;
  topic?: string | null;
  subject?: string | null;
  imageData?: string | null;
}

export interface ValidationResult {
  ok: boolean;          // true when there are no blocking errors
  errors: string[];     // blocking — must be fixed before PUBLISHED
  warnings: string[];   // advisory — shown to the reviewer
}

/** Normalise an option/answer string for comparison (trim, collapse spaces, strip a leading ★). */
function norm(s: string): string {
  return s.replace(/^★\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function validateQuestion(q: QuestionInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const question = (q.question || '').trim();
  const options = (q.options || []).map((o) => (o || '').trim()).filter(Boolean);
  const answer = (q.answer || '').trim();
  const solution = (q.solution || '').trim();
  const topic = (q.topic || '').trim();

  // ─── Question text ───────────────────────────────────────────────
  if (!question) {
    errors.push('Question text is empty.');
  } else if (question.length < 10) {
    warnings.push('Question text is very short — is it complete?');
  }

  // ─── Topic ───────────────────────────────────────────────────────
  if (!topic) errors.push('No topic set.');

  // ─── Options ─────────────────────────────────────────────────────
  if (options.length < 2) {
    errors.push('A multiple-choice question needs at least 2 options.');
  } else {
    if (options.length < 4) {
      warnings.push(`Only ${options.length} options — CAPS MCQs usually have 4.`);
    }
    const seen = new Set<string>();
    let dupes = 0;
    for (const o of options) {
      const key = norm(o);
      if (seen.has(key)) dupes++;
      seen.add(key);
    }
    if (dupes > 0) errors.push(`${dupes} duplicate option(s) — every option must be distinct.`);
  }

  // ─── Answer ──────────────────────────────────────────────────────
  if (!answer) {
    errors.push('No correct answer set.');
  } else if (options.length >= 2) {
    const match = options.some((o) => norm(o) === norm(answer));
    if (!match) {
      errors.push('The correct answer does not exactly match any option.');
    }
  }

  // ─── Solution ────────────────────────────────────────────────────
  if (!solution) {
    warnings.push('No worked solution — students learn far more with steps.');
  } else if (solution.length < 15) {
    warnings.push('Worked solution is very thin.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Convenience: validate and return ONLY the blocking errors as a string[],
 * matching the shape stored in `Question.validationErrors`.
 */
export function validationErrorsFor(q: QuestionInput): string[] {
  return validateQuestion(q).errors;
}
