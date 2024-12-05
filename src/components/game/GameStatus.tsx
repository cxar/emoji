interface GameStatusProps {
  isGameOver: boolean;
  onShowResults: () => void;
  lives: number;
  maxAttempts: number;
}

export function GameStatus({
  isGameOver,
  onShowResults,
  lives,
  maxAttempts
}: GameStatusProps) {
  return (
    <div className="mt-4 flex justify-center">
      {isGameOver ? (
        <button
          onClick={onShowResults}
          className="text-blue-500 hover:text-blue-600 font-medium"
        >
          Show Results
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Mistakes remaining:</span>
          <div className="flex gap-1">
            {Array.from({ length: maxAttempts }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${i < lives ? 'bg-gray-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 