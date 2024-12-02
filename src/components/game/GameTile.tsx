import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GameTileProps {
  emoji: string;
  gridRow: number;
  gridCol: number;
  isSelected: boolean;
  isAnimating: boolean;
  isCompleted?: boolean;
  tileSize: number;
  gap: number;
  isFading?: boolean;
  onClick: () => void;
}

export function GameTile({
  emoji,
  gridRow,
  gridCol,
  isSelected,
  isAnimating,
  isCompleted,
  tileSize,
  gap,
  isFading,
  onClick
}: GameTileProps) {
  return (
    <motion.button
      layout
      onClick={onClick}
      initial={false}
      animate={{
        opacity: isFading ? 0 : 1,
      }}
      style={{
        position: 'absolute',
        top: gridRow * (tileSize + gap),
        left: gridCol * (tileSize + gap),
        width: tileSize,
        height: tileSize,
      }}
      className={cn(
        "rounded-lg text-2xl flex items-center justify-center transition-colors",
        isSelected ? "bg-gray-200" : "bg-white hover:bg-gray-100",
        "border border-gray-200 text-4xl"
      )}
    >
      {emoji}
    </motion.button>
  );
} 