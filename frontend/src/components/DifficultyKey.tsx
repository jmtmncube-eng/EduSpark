import { useState } from 'react';
import { ALL_DIFFICULTIES } from '../utils/difficulty';

/**
 * Inline cheatsheet shown to tutors/admins explaining what the friendly
 * difficulty names mean academically. Defaults to a compact one-liner that
 * expands when clicked.
 */
export default function DifficultyKey({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);

  if (inline) {
    return (
      <span className="xs ct3" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {ALL_DIFFICULTIES.map((m) => (
          <span key={m.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 8px', borderRadius: 99,
            background: m.bg, color: m.fg, border: `1px solid ${m.borderColor}`,
            fontSize: 10.5, fontWeight: 700,
          }}>
            {m.icon} {m.label}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div style={{
      background: 'rgba(20,184,166,.05)',
      border: '1px solid var(--bd)',
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '8px 12px',
          background: 'transparent', border: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: 'inherit', fontSize: 12,
        }}
      >
        <span className="bold">🗝️ Difficulty key — what these mean academically</span>
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <div className="xs ct3 mb1">Student-facing labels (left) ↔ academic level (right):</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {ALL_DIFFICULTIES.map((m) => (
              <div key={m.key} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 8px',
                background: m.bg, border: `1px solid ${m.borderColor}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div className="sm bold" style={{ color: m.fg }}>
                    {m.label}
                    <span className="xs ct3" style={{ fontWeight: 400, marginLeft: 8 }}>
                      (was “{m.key.charAt(0)}{m.key.slice(1).toLowerCase()}”)
                    </span>
                  </div>
                  <div className="xs ct2" style={{ marginTop: 1 }}>{m.tutorHint}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="xs ct3 mt2" style={{ fontStyle: 'italic' }}>
            Students never see “Easy / Medium / Hard” — only the friendly names.
          </div>
        </div>
      )}
    </div>
  );
}
