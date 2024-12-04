export function LoadingState() {
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