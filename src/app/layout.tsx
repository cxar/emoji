import './globals.css';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/Footer';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Emoji Connections',
  description: 'A daily word association game with emojis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <div className="h-full flex flex-col">
          <main className="container mx-auto px-4 pt-8 flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
