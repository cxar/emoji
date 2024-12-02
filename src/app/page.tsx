import { Redis } from '@upstash/redis';
import { DailyPuzzle } from '@/types';
import { Board } from '@/components/game/Board';
import { Suspense } from 'react';

const redis = Redis.fromEnv();

function LoadingState() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-4 gap-2 aspect-square">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <div className="w-20 h-10 bg-gray-200 rounded-lg"></div>
        <div className="w-24 h-10 bg-gray-200 rounded-lg"></div>
        <div className="w-20 h-10 bg-gray-200 rounded-lg"></div>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="w-48 h-6 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

async function GameBoard() {
  const today = new Date().toISOString().split('T')[0];
  const puzzle = await redis.get<DailyPuzzle>(`puzzle:${today}`);
  
  if (!puzzle) {
    throw new Error('No puzzle found for today');
  }

  if (typeof puzzle === 'string') {
    try {
      return <Board puzzle={JSON.parse(puzzle)} />;
    } catch (e) {
      throw new Error('Failed to parse puzzle data');
    }
  }

  return <Board puzzle={puzzle} />;
}

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto sm:pt-1 md:pt-2">
      <header className="text-center mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Emoji Connections</h1>
        <p className="text-sm sm:text-base text-gray-600 mb-2 sm:mb-4">
          Find groups of four emojis that share a common theme.
        </p>
        <p className="text-xs sm:text-sm text-gray-500">
          New puzzle every day
        </p>
      </header>

      <div className="w-full max-w-md mx-auto">
        <Suspense fallback={<LoadingState />}>
          <GameBoard />
        </Suspense>
      </div>
    </div>
  );
}