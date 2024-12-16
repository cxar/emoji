import Link from 'next/link';

export function Footer() {
  return (
    <div className="py-4 text-center text-gray-500">
      <div className="mt-2">
        <Link 
          href='https://ko-fi.com/W7W317JUAM'
          target='_blank'
          rel='noopener noreferrer'
          className='text-blue-500 hover:text-blue-700'
        >
          Buy me a coffee ☕
        </Link>
      </div>
    </div>
  );
}