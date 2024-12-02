import { AnimatePresence, motion } from 'framer-motion';
import { Solution } from '@/types';
import { cn } from '@/lib/utils';

interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  solvedGroups: Solution[];
  solvedGroupsAtGameOver: number | null;
  totalGroups: number;
  didWin: boolean;
  onShare: () => void;
  shareStatus: 'copy' | 'copied';
  shareText: string;
}

export function GameOverModal({
  isOpen,
  onClose,
  solvedGroups,
  solvedGroupsAtGameOver,
  totalGroups,
  didWin,
  onShare,
  shareStatus,
  shareText
}: GameOverModalProps) {
  if (!isOpen) return null;

  const allGroups = [...solvedGroups].sort((a, b) => a.difficulty - b.difficulty);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center z-[100]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative w-full max-w-md mx-4"
        >
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                {didWin ? (
                  <>
                    You Won! 🎉
                    <div className="text-base font-normal text-gray-600 mt-1">
                      All connections found!
                    </div>
                  </>
                ) : (
                  <>
                    Game Over
                    <div className="text-base font-normal text-gray-600 mt-1">
                      {solvedGroupsAtGameOver === 0 
                        ? "No connections found" 
                        : `Found ${solvedGroupsAtGameOver} of ${totalGroups} connections`}
                    </div>
                  </>
                )}
              </h2>

              <div className="mt-6">
                {/* Share Preview */}
                <div className="font-mono text-lg whitespace-pre-wrap bg-gray-50 p-4 rounded-lg mb-6">
                  {shareText}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={onShare}
                    className={cn(
                      "w-full max-w-[200px] px-4 py-2.5 rounded-lg font-medium transition-all",
                      shareStatus === 'copy' 
                        ? "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
                        : "bg-green-500 text-white"
                    )}
                  >
                    {shareStatus === 'copy' ? 'Share Results' : 'Copied!'}
                  </button>
                  
                  <button
                    onClick={() => {
                      onClose();
                      // Prevent modal from reappearing
                      setTimeout(() => onClose(), 0);
                    }}
                    className="w-full max-w-[200px] px-4 py-2.5 rounded-lg font-medium border border-gray-200 
                             hover:bg-gray-50 active:bg-gray-100 transition-all"
                  >
                    View Board
                  </button>

                  <div className="text-sm text-gray-500 mt-2">
                    Come back tomorrow for a new puzzle
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
} 