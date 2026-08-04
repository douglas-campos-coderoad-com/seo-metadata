'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Item } from '@/lib/hooks';

interface ItemCardProps {
  item: Item;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  const imageUrl = item.image_urls?.[0] || 'https://via.placeholder.com/400x300?text=No+Image';

  return (
    <Link href={`/browse/${item.id}`}>
      <div className='rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow cursor-pointer bg-white'>
        <div className='relative w-full h-64 bg-gray-200'>
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            className='object-cover'
          />
        </div>
        <div className='p-4'>
          <h3 className='text-lg font-bold text-gray-900 truncate'>{item.title}</h3>
          <p className='text-sm text-gray-600 mt-1'>{item.dealer.name}</p>
          <div className='flex justify-between items-center mt-3'>
            <span className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded'>
              {item.category.name}
            </span>
            <span className='text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded'>
              {item.period.name}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
