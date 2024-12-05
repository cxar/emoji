interface GameControlsProps {
  onShuffle: () => void;
  onDeselectAll: () => void;
  onSubmit: () => void;
  selectedCount: number;
  isDisabled: boolean;
  solvedGroupsCount: number;
  totalGroups: number;
}

export function GameControls({
  onShuffle,
  onDeselectAll,
  onSubmit,
  selectedCount,
  isDisabled,
  solvedGroupsCount,
  totalGroups
}: GameControlsProps) {
  return (
    <div className="mt-4 flex justify-center gap-4">
      <button
        onClick={onShuffle}
        disabled={solvedGroupsCount === totalGroups || isDisabled}
        className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Shuffle
      </button>
      <button
        onClick={onDeselectAll}
        disabled={selectedCount === 0 || isDisabled}
        className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Deselect All
      </button>
      <button
        onClick={onSubmit}
        disabled={selectedCount !== 4 || isDisabled}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  );
} 