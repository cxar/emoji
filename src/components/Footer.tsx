import Link from 'next/link';

export function Footer() {
  return (
    <div className="py-4 text-center">
      <div className="mt-2">
        <Link 
          href='https://ko-fi.com/W7W317JUAM'
          className='text-blue-500 hover:text-blue-600'
        >
          Buy me a coffee ☕
        </Link>
      </div>
    </div>
  );
}