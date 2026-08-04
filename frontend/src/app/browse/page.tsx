'use client';

import { useState } from 'react';
import { BrowseGallery } from '@/components/BrowseGallery';
import { ItemFilters } from '@/components/ItemFilters';

export default function BrowsePage() {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(null);

  const handleFilterChange = (newCategoryId: number | null, newPeriodId: number | null) => {
    setCategoryId(newCategoryId);
    setPeriodId(newPeriodId);
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white border-b border-gray-200 py-8'>
        <div className='max-w-7xl mx-auto px-4'>
          <h1 className='text-4xl font-bold text-gray-900 mb-2'>Curated Marketplace</h1>
          <p className='text-gray-600'>Discover unique items from around the world</p>
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-4 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
          {/* Sidebar Filters */}
          <div className='lg:col-span-1'>
            <ItemFilters onFilterChange={handleFilterChange} />
          </div>

          {/* Gallery */}
          <div className='lg:col-span-3'>
            <BrowseGallery categoryId={categoryId} periodId={periodId} />
          </div>
        </div>
      </div>
    </div>
  );
}
