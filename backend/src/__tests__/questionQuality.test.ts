import { describe, it, expect } from 'vitest';
import { computeQualityFlag } from '../utils/questionQuality';

describe('computeQualityFlag', () => {
  it('flags a question with zero attempts as unproven', () => {
    expect(computeQualityFlag({ attempts: 0, correctRate: 0, discrimination: 0 })).toBe('no_attempts');
  });

  it('does not flag a question with too few attempts to judge', () => {
    expect(computeQualityFlag({ attempts: 3, correctRate: 5, discrimination: 0 })).toBeNull();
  });

  it('flags a likely-broken question (lots of attempts, almost nobody right)', () => {
    expect(computeQualityFlag({ attempts: 20, correctRate: 8, discrimination: 5 })).toBe('broken');
  });

  it('flags a trivial question (almost everybody right)', () => {
    expect(computeQualityFlag({ attempts: 20, correctRate: 99, discrimination: 2 })).toBe('trivial');
  });

  it('flags low discrimination once there is enough data', () => {
    expect(computeQualityFlag({ attempts: 30, correctRate: 60, discrimination: 3 })).toBe('low_discrimination');
  });

  it('returns null for a healthy question', () => {
    expect(computeQualityFlag({ attempts: 30, correctRate: 62, discrimination: 35 })).toBeNull();
  });
});
