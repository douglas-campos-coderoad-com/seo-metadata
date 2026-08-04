'use client';

import { useState } from 'react';
import { useCategories, usePeriods, Category, Period } from '@/lib/hooks';

interface ItemFiltersProps {
  onFilterChange: (categoryId: number | null, periodId: number | null) => void;
}

export const ItemFilters: React.FC<ItemFiltersProps> = ({ onFilterChange }) => {
  const { data: categories } = useCategories();
  const { data: periods } = usePeriods();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  const handleCategoryChange = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    onFilterChange(categoryId, selectedPeriod);
  };

  const handlePeriodChange = (periodId: number | null) => {
    setSelectedPeriod(periodId);
    onFilterChange(selectedCategory, periodId);
  };

  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSelectedPeriod(null);
    onFilterChange(null, null);
  };

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <h2 className='text-lg font-bold text-gray-900 mb-4'>Filters</h2>

      <div className='space-y-4'>
        {/* Category Filter */}
        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Category
          </label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => handleCategoryChange(e.target.value ? parseInt(e.target.value) : null)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Filter */}
        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Period
          </label>
          <select
            value={selectedPeriod || ''}
            onChange={(e) => handlePeriodChange(e.target.value ? parseInt(e.target.value) : null)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>All Periods</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {(selectedCategory || selectedPeriod) && (
          <button
            onClick={handleClearFilters}
            className='w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium'
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
