import { getTodaysPuzzle } from '@/lib/puzzleGeneration';
import { Board } from '@/components/game/Board';
import { Suspense } from 'react';

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
  const puzzle = await getTodaysPuzzle();
  return <Board puzzle={puzzle} />;
}

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto">
      <header className="text-center mb-4 mt-2 sm:mb-8 sm:mt-0">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 sm:mb-4">Emoji Connections</h1>
        <p className="text-gray-600 mb-2 sm:mb-4">
          Find groups of four emojis that share a common theme.
        </p>
        <p className="text-sm text-gray-500">
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