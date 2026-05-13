import { useRef } from 'react';

/**
 * A row of common Math/Science symbol buttons that insert into the focused
 * textarea/input. Used in the manual question creation form so tutors don't
 * have to hunt for special characters.
 *
 * Usage:
 *   const ref = useRef<HTMLTextAreaElement>(null);
 *   <textarea ref={ref} value={...} onChange={...} />
 *   <SnippetToolbar targetRef={ref} onChange={(v) => setForm({ ...form, question: v })} value={form.question} />
 */

interface Snippet { label: string; insert: string; hint?: string }

const GROUPS: { title: string; snippets: Snippet[] }[] = [
  {
    title: 'Powers / roots',
    snippets: [
      { label: 'x²', insert: '²' },
      { label: 'x³', insert: '³' },
      { label: 'xⁿ', insert: '^n' },
      { label: '√', insert: '√' },
      { label: '∛', insert: '∛' },
      { label: '¹⁄ₓ', insert: '⁻¹' },
    ],
  },
  {
    title: 'Operators',
    snippets: [
      { label: '×', insert: '×' },
      { label: '÷', insert: '÷' },
      { label: '±', insert: '±' },
      { label: '≤', insert: '≤' },
      { label: '≥', insert: '≥' },
      { label: '≠', insert: '≠' },
      { label: '≈', insert: '≈' },
      { label: '∞', insert: '∞' },
    ],
  },
  {
    title: 'Greek',
    snippets: [
      { label: 'π', insert: 'π' },
      { label: 'θ', insert: 'θ' },
      { label: 'α', insert: 'α' },
      { label: 'β', insert: 'β' },
      { label: 'Δ', insert: 'Δ' },
      { label: 'Σ', insert: 'Σ' },
      { label: 'λ', insert: 'λ' },
      { label: 'μ', insert: 'μ' },
      { label: 'Ω', insert: 'Ω' },
    ],
  },
  {
    title: 'Units',
    snippets: [
      { label: '°', insert: '°' },
      { label: 'm/s', insert: ' m/s' },
      { label: 'm/s²', insert: ' m/s²' },
      { label: 'N', insert: ' N' },
      { label: 'J', insert: ' J' },
      { label: 'kg', insert: ' kg' },
      { label: 'V', insert: ' V' },
      { label: 'A', insert: ' A' },
    ],
  },
  {
    title: 'Logic',
    snippets: [
      { label: '→', insert: ' → ' },
      { label: '⇔', insert: ' ⇔ ' },
      { label: '⊕', insert: ' ⊕ ' },
      { label: '∴', insert: ' ∴ ' },
      { label: '⊥', insert: ' ⊥ ' },
      { label: '∥', insert: ' ∥ ' },
    ],
  },
];

interface Props {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
}

export default function SnippetToolbar({ targetRef, value, onChange }: Props) {
  const focusedAt = useRef<number | null>(null);

  function rememberCaret() {
    const el = targetRef.current;
    if (!el) return;
    focusedAt.current = el.selectionStart ?? value.length;
  }

  function insert(piece: string) {
    const el = targetRef.current;
    if (!el) {
      // Fallback: append to the end
      onChange(value + piece);
      return;
    }
    const start = focusedAt.current ?? el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const next = value.slice(0, start) + piece + value.slice(end);
    onChange(next);
    // Restore caret after React applies the change
    setTimeout(() => {
      try {
        el.focus();
        const pos = start + piece.length;
        el.setSelectionRange(pos, pos);
        focusedAt.current = pos;
      } catch { /* ignore */ }
    }, 0);
  }

  return (
    <div
      onMouseDown={(e) => { rememberCaret(); e.preventDefault(); }}
      style={{
        border: '1px solid var(--bd)', borderRadius: 10,
        padding: '6px 8px', marginTop: 6, background: 'var(--bg2, var(--bg))',
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      }}
      aria-label="Math symbol toolbar"
    >
      {GROUPS.map((g, gi) => (
        <span key={g.title} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: gi < GROUPS.length - 1 ? 6 : 0, borderRight: gi < GROUPS.length - 1 ? '1px solid var(--bd)' : 'none' }}>
          {g.snippets.map((s) => (
            <button
              key={g.title + s.label}
              type="button"
              onClick={() => insert(s.insert)}
              title={`Insert ${s.insert.trim() || s.label}`}
              style={{
                minWidth: 30, padding: '4px 8px', fontSize: 13,
                background: 'var(--bg)', border: '1px solid var(--bd)',
                borderRadius: 6, cursor: 'pointer', lineHeight: 1.2,
                color: 'var(--t)',
              }}
            >
              {s.label}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}
