'use client';

import { useState } from 'react';
import Image from 'next/image';

export interface ItemDetailData {
  id: number;
  title: string;
  description?: string;
  image_urls: string[];
  category: { id: number; name: string };
  period: { id: number; name: string };
  dealer: { id: number; name: string; inquiries_enabled: boolean };
  condition?: string;
  asking_price?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ItemDetailProps {
  item: ItemDetailData;
}

export const ItemDetail: React.FC<ItemDetailProps> = ({ item }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = item.image_urls || [];
  const mainImage = images[currentImageIndex] || 'https://via.placeholder.com/600x400?text=No+Image';

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
      {/* Images */}
      <div>
        <div className='relative w-full aspect-square bg-gray-200 rounded-lg overflow-hidden'>
          <Image
            src={mainImage}
            alt={item.title}
            fill
            className='object-cover'
          />
        </div>
        {images.length > 1 && (
          <div className='flex gap-2 mt-4'>
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${
                  idx === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
                }`}
              >
                <Image
                  src={img}
                  alt={`${item.title} ${idx + 1}`}
                  fill
                  className='object-cover'
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className='space-y-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>{item.title}</h1>
          <div className='flex gap-2'>
            <span className='bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium'>
              {item.category.name}
            </span>
            <span className='bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium'>
              {item.period.name}
            </span>
          </div>
        </div>

        {item.description && (
          <div>
            <h2 className='text-lg font-semibold text-gray-900 mb-2'>Description</h2>
            <p className='text-gray-700'>{item.description}</p>
          </div>
        )}

        <div className='grid grid-cols-2 gap-4 pt-6 border-t border-gray-200'>
          {item.condition && (
            <div>
              <p className='text-sm text-gray-600'>Condition</p>
              <p className='text-lg font-semibold text-gray-900'>{item.condition}</p>
            </div>
          )}
          {item.asking_price && (
            <div>
              <p className='text-sm text-gray-600'>Price</p>
              <p className='text-lg font-semibold text-gray-900'>
                ${item.asking_price.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Dealer Info */}
        <div className='bg-gray-50 rounded-lg p-6 border border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-900 mb-3'>Dealer Information</h3>
          <p className='text-gray-700 mb-4'>{item.dealer.name}</p>
          {item.dealer.inquiries_enabled && (
            <button className='w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold'>
              Send Inquiry
            </button>
          )}
          {!item.dealer.inquiries_enabled && (
            <p className='text-sm text-gray-600 text-center py-3'>
              This dealer is not currently accepting inquiries
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
