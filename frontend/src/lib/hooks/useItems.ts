'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api-client';

export interface Item {
  id: number;
  title: string;
  image_urls: string[];
  status: string;
  category: { id: number; name: string };
  period: { id: number; name: string };
  dealer: { id: number; name: string; inquiries_enabled: boolean };
  created_at: string;
  updated_at: string;
}

export interface ItemsResponse {
  items: Item[];
  total: number;
  skip: number;
  limit: number;
}

export const useItems = () => {
  const [data, setData] = useState<ItemsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(
    async (
      categoryId?: number | null,
      periodId?: number | null,
      skip = 0,
      limit = 20
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (categoryId) params.append('category_id', categoryId.toString());
        if (periodId) params.append('period_id', periodId.toString());
        params.append('skip', skip.toString());
        params.append('limit', limit.toString());

        const result = await apiClient.get<ItemsResponse>(
          `/items?${params.toString()}`
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch items'));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { data, isLoading, error, fetchItems };
};
