/**
 * PillSelect — a tappable, fully-visible single-choice control.
 *
 * Replaces native <select> dropdowns wherever a guided, "prompting" feel is
 * wanted: every option is visible at once, one tap to choose, no hidden menu.
 * Used across the Question Bank (browse + add/edit) so the whole surface
 * speaks the same language as the generator wizard.
 */
export interface PillOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  hint?: string;
}

export default function PillSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: PillOption<T>[];
  ariaLabel?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex ia g1 wrap" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value || '__empty'}
            type="button"
            title={o.hint}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`btn ${size === 'sm' ? 'btn-sm' : ''}`}
            style={{
              background: active ? 'var(--p)' : 'var(--bg)',
              color: active ? '#fff' : 'var(--t)',
              border: `1px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
              fontWeight: active ? 700 : 500,
              transition: 'background .12s, border-color .12s',
            }}
          >
            {o.icon ? `${o.icon} ` : ''}{o.label}
          </button>
        );
      })}
    </div>
  );
}
