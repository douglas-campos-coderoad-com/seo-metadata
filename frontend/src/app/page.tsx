import Link from 'next/link';

export default function Home() {
  return (
    <div className='min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white'>
      {/* Header */}
      <header className='border-b border-gray-700'>
        <div className='max-w-7xl mx-auto px-4 py-6 flex justify-between items-center'>
          <h1 className='text-2xl font-bold'>InCollect</h1>
          <nav className='space-x-6'>
            <Link href='/browse' className='hover:text-gray-300 transition-colors'>
              Browse
            </Link>
            <Link href='/auth/login' className='hover:text-gray-300 transition-colors'>
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className='max-w-7xl mx-auto px-4 py-24'>
        <div className='text-center space-y-6 mb-12'>
          <h2 className='text-5xl font-bold'>Curated Marketplace for Fine Objects</h2>
          <p className='text-xl text-gray-300'>
            Discover rare furniture, art, antiques, and jewelry from curated dealers worldwide.
          </p>
          <p className='text-lg text-gray-400'>
            Commission-free introductions to dealers and collectors.
          </p>
        </div>

        <div className='text-center'>
          <Link
            href='/browse'
            className='inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors'
          >
            Start Browsing
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className='max-w-7xl mx-auto px-4 py-16'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
          <div className='bg-gray-700 p-6 rounded-lg'>
            <h3 className='text-lg font-bold mb-2'>Curated Selection</h3>
            <p className='text-gray-300'>
              Browse carefully selected items from established dealers.
            </p>
          </div>
          <div className='bg-gray-700 p-6 rounded-lg'>
            <h3 className='text-lg font-bold mb-2'>Expert Dealers</h3>
            <p className='text-gray-300'>
              Connect directly with trusted collectors and specialists.
            </p>
          </div>
          <div className='bg-gray-700 p-6 rounded-lg'>
            <h3 className='text-lg font-bold mb-2'>Commission-Free</h3>
            <p className='text-gray-300'>
              No platform fees or commissions on any transaction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
