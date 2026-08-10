import type { Recurrence } from '@/shared/types';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutesStr.padStart(2, '0')} ${period}`;
}

function ordinal(day: number): string {
  const lastDigit = day % 10;
  const lastTwoDigits = day % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${day}st`;
  if (lastDigit === 2 && lastTwoDigits !== 12) return `${day}nd`;
  if (lastDigit === 3 && lastTwoDigits !== 13) return `${day}rd`;
  return `${day}th`;
}

/** Turns a structured Recurrence into the plain-language label FR-022 requires. */
export function formatRecurrence(recurrence: Recurrence): string {
  const time = formatTime(recurrence.time);
  switch (recurrence.frequency) {
    case 'daily':
      return `Every day at ${time}`;
    case 'weekly':
      return `Every ${WEEKDAY_LABELS[recurrence.weekday ?? 1]} at ${time}`;
    case 'monthly':
      return `Monthly on the ${ordinal(recurrence.dayOfMonth ?? 1)} at ${time}`;
    default:
      return time;
  }
}

/** Computes the next occurrence of a Recurrence strictly after `from`. */
export function computeNextRunAt(recurrence: Recurrence, from: Date = new Date()): string {
  const next = new Date(from);
  const [hours, minutes] = recurrence.time.split(':').map(Number);
  next.setHours(hours, minutes, 0, 0);

  if (recurrence.frequency === 'daily') {
    if (next <= from) next.setDate(next.getDate() + 1);
  } else if (recurrence.frequency === 'weekly') {
    const targetWeekday = recurrence.weekday ?? 1;
    let daysUntil = (targetWeekday - next.getDay() + 7) % 7;
    if (daysUntil === 0 && next <= from) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
  } else {
    const targetDay = recurrence.dayOfMonth ?? 1;
    next.setDate(targetDay);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1, targetDay);
    }
  }

  return next.toISOString();
}
