import { describe, expect, it } from 'vitest';
import { computeNextRunAt, formatRecurrence } from '@/features/automations/lib/recurrence';
import type { Recurrence } from '@/shared/types';

describe('formatRecurrence', () => {
  it('formats daily recurrence', () => {
    expect(formatRecurrence({ frequency: 'daily', time: '09:00' })).toBe('Every day at 9:00 AM');
  });

  it('formats weekly recurrence with weekday name', () => {
    expect(formatRecurrence({ frequency: 'weekly', time: '13:30', weekday: 1 })).toBe('Every Monday at 1:30 PM');
  });

  it('formats monthly recurrence with an ordinal day', () => {
    expect(formatRecurrence({ frequency: 'monthly', time: '00:00', dayOfMonth: 1 })).toBe(
      'Monthly on the 1st at 12:00 AM',
    );
    expect(formatRecurrence({ frequency: 'monthly', time: '00:00', dayOfMonth: 22 })).toBe(
      'Monthly on the 22nd at 12:00 AM',
    );
    expect(formatRecurrence({ frequency: 'monthly', time: '00:00', dayOfMonth: 11 })).toBe(
      'Monthly on the 11th at 12:00 AM',
    );
  });
});

describe('computeNextRunAt', () => {
  it('schedules a daily recurrence for later today if the time has not passed', () => {
    const from = new Date('2026-01-01T08:00:00');
    const recurrence: Recurrence = { frequency: 'daily', time: '09:00' };
    const next = new Date(computeNextRunAt(recurrence, from));
    expect(next.getDate()).toBe(1);
    expect(next.getHours()).toBe(9);
  });

  it('rolls a daily recurrence to tomorrow if the time already passed today', () => {
    const from = new Date('2026-01-01T10:00:00');
    const recurrence: Recurrence = { frequency: 'daily', time: '09:00' };
    const next = new Date(computeNextRunAt(recurrence, from));
    expect(next.getDate()).toBe(2);
  });

  it('computes the next matching weekday for a weekly recurrence', () => {
    // 2026-01-01 is a Thursday (weekday 4); target Monday (1) should land on 2026-01-05.
    const from = new Date('2026-01-01T08:00:00');
    const recurrence: Recurrence = { frequency: 'weekly', time: '09:00', weekday: 1 };
    const next = new Date(computeNextRunAt(recurrence, from));
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(5);
  });

  it('rolls a monthly recurrence to next month if the day already passed', () => {
    const from = new Date('2026-01-15T08:00:00');
    const recurrence: Recurrence = { frequency: 'monthly', time: '09:00', dayOfMonth: 1 };
    const next = new Date(computeNextRunAt(recurrence, from));
    expect(next.getMonth()).toBe(1); // February (0-indexed)
    expect(next.getDate()).toBe(1);
  });
});
