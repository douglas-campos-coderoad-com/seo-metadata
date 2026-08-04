'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../api-client';

export interface Period {
  id: number;
  name: string;
  start_year: number;
  end_year: number;
  created_at: string;
  updated_at: string;
}

export const usePeriods = () => {
  const [data, setData] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const result = await apiClient.get<Period[]>('/periods');
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch periods'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeriods();
  }, []);

  return { data, isLoading, error };
};
