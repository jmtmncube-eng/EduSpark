import { useEffect, useState } from 'react';
import Modal from './Modal';
import { assignments as assignmentsApi } from '../services/api';
import { showToast } from './Toast';
import { diffMeta } from '../utils/difficulty';

type Heatmap = Awaited<ReturnType<typeof assignmentsApi.heatmap>>;

/**
 * Per-question correctness bar for an assignment — instant tutor read-out
 * on which questions tripped the class.
 */
export default function AssignmentHeatmap({ assignmentId, title, onClose }: { assignmentId: string; title: string; onClose: () => void }) {
  const [data, setData] = useState<Heatmap | null>(null);

  useEffect(() => {
    assignmentsApi.heatmap(assignmentId)
      .then(setData)
      .catch((e) => { showToast(String((e as Error).message), 'err'); onClose(); });
  }, [assignmentId, onClose]);

  if (!data) return <Modal title="Loading heatmap…" onClose={onClose}><div className="ct3" style={{ padding: 20 }}>…</div></Modal>;
  if (!data.rows.length) return (
    <Modal title={`🔥 ${title}`} onClose={onClose}>
      <div className="sm" style={{ color: 'var(--t2)', padding: 20, textAlign: 'center' }}>
        No submissions yet — once students start finishing, this view shows which questions tripped them up.
      </div>
    </Modal>
  );

  return (
    <Modal title={`🔥 Question heatmap · ${title}`} onClose={onClose}>
      <p className="sm" style={{ color: 'var(--t2)', marginBottom: 12 }}>
        Each bar shows the % of students who got that question right. <b>Reteach the red ones.</b>
      </p>

      <div style={{ display: 'grid', gap: 6 }}>
        {data.rows.map((r) => {
          const meta = diffMeta(r.difficulty);
          const tone =
            r.correctRate >= 75 ? '#16a34a' :
            r.correctRate >= 50 ? '#b45309' :
            '#b91c1c';
          return (
            <div key={r.questionId} style={{
              padding: 10, border: '1px solid var(--bd)', borderRadius: 10,
              background: 'var(--bg)',
            }}>
              <div className="flex jb ia" style={{ marginBottom: 6, gap: 8 }}>
                <div className="sm" style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: 'var(--t)' }}>Q{r.index}.</b>{' '}
                  <span style={{ color: 'var(--t2)' }}>{r.question.length > 80 ? r.question.slice(0, 80) + '…' : r.question}</span>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: 99,
                  fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                  background: meta.bg, color: meta.fg, border: `1px solid ${meta.borderColor}`,
                }}>{meta.icon} {meta.label}</span>
              </div>
              <div className="flex ia" style={{ gap: 8 }}>
                <div style={{
                  flex: 1, height: 12, background: 'var(--bd)',
                  borderRadius: 99, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${r.correctRate}%`, height: '100%',
                    background: tone, transition: 'width .3s',
                  }} />
                </div>
                <span style={{ fontWeight: 700, color: tone, minWidth: 44, textAlign: 'right' }}>
                  {r.correctRate}%
                </span>
                <span className="xs" style={{ color: 'var(--t3)', minWidth: 60, textAlign: 'right' }}>
                  {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
