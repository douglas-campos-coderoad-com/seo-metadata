'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ItemDetail, ItemDetailData } from '@/components/ItemDetail';
import { apiClient } from '@/lib/api-client';

export default function ItemDetailPage() {
  const params = useParams();
  const itemId = parseInt(params.itemId as string);
  const [item, setItem] = useState<ItemDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const data = await apiClient.get<ItemDetailData>(`/items/${itemId}`);
        setItem(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setIsLoading(false);
      }
    };

    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4' />
          <p className='text-gray-600'>Loading item details...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-red-600 mb-4'>Error: {error || 'Item not found'}</p>
          <Link
            href='/browse'
            className='inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
          >
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        <Link
          href='/browse'
          className='text-blue-600 hover:text-blue-700 font-medium mb-6 inline-block'
        >
          ← Back to Browse
        </Link>

        <ItemDetail item={item} />
      </div>
    </div>
  );
}
