import { getTodaysPuzzle } from '@/lib/utils';
import { Board } from '@/components/game/Board';
import { Suspense } from 'react';

function LoadingState() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-4 mx-auto"></div>
      <div className="h-4 w-96 bg-gray-200 rounded mb-2 mx-auto"></div>
      <div className="h-4 w-72 bg-gray-200 rounded mb-8 mx-auto"></div>
      <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

async function GameBoard() {
  const puzzle = await getTodaysPuzzle();
  return <Board puzzle={puzzle} />;
}

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Emoji Connections</h1>
        <p className="text-gray-600 mb-4">
          Find groups of four emojis that share a common theme.
        </p>
        <p className="text-sm text-gray-500">
          New puzzle every day
        </p>
      </header>

      <Suspense fallback={<LoadingState />}>
        <GameBoard />
      </Suspense>
    </div>
  );
}