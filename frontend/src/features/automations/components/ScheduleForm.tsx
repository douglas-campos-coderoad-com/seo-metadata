'use client';

import { useState, type FormEvent } from 'react';
import { Label } from '@/shared/components/ui/label';
import { Select } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import type { Recurrence, RecurrenceFrequency } from '@/shared/types';

interface ScheduleFormProps {
  onSubmit: (recurrence: Recurrence) => void;
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function ScheduleForm({ onSubmit }: ScheduleFormProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [time, setTime] = useState('09:00');
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recurrence: Recurrence =
      frequency === 'weekly'
        ? { frequency, time, weekday }
        : frequency === 'monthly'
          ? { frequency, time, dayOfMonth }
          : { frequency, time };
    onSubmit(recurrence);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="schedule-frequency">Frequency</Label>
          <Select
            id="schedule-frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>

        {frequency === 'weekly' && (
          <div>
            <Label htmlFor="schedule-weekday">Day of week</Label>
            <Select id="schedule-weekday" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
              {WEEKDAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {frequency === 'monthly' && (
          <div>
            <Label htmlFor="schedule-day-of-month">Day of month</Label>
            <Input
              id="schedule-day-of-month"
              type="number"
              min={1}
              max={28}
              className="w-24"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(Number(event.target.value))}
            />
          </div>
        )}

        <div>
          <Label htmlFor="schedule-time">Time</Label>
          <Input id="schedule-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      </div>

      <Button type="submit" className="self-start">
        Save schedule
      </Button>
    </form>
  );
}
