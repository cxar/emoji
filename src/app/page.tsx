import { ClientBoard, ClientDailyMessage } from '@/components/game';

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto sm:pt-1 md:pt-2">
      <header className="text-center mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Emoji Connections</h1>
        <p className="text-sm sm:text-base text-gray-600 mb-2 sm:mb-4">
          Find groups of four emojis that share a common theme.
        </p>
        <ClientDailyMessage />
      </header>

      <div className="w-full max-w-md mx-auto">
        <ClientBoard />
      </div>
    </div>
  );
}