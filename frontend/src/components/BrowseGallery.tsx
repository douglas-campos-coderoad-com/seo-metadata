'use client';

import { useItems, Item } from '@/lib/hooks';
import { ItemCard } from './ItemCard';

interface BrowseGalleryProps {
  categoryId?: number | null;
  periodId?: number | null;
}

export const BrowseGallery: React.FC<BrowseGalleryProps> = ({ categoryId, periodId }) => {
  const { data, isLoading, error, fetchItems } = useItems();

  React.useEffect(() => {
    fetchItems(categoryId, periodId);
  }, [categoryId, periodId, fetchItems]);

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='bg-gray-200 rounded-lg h-80 animate-pulse' />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-red-50 border border-red-200 rounded-lg p-4 text-red-800'>
        Error loading items: {error.message}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-500 text-lg'>No items found matching your filters.</p>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6'>
        <p className='text-gray-600'>
          Showing {data.items.length} of {data.total} items
        </p>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {data.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
