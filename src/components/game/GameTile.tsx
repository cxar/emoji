import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GameTileProps {
  emoji: string;
  gridRow: number;
  gridCol: number;
  isSelected: boolean;
  isAnimating: boolean;
  isFading?: boolean;
  tileSize: number;
  gap: number;
  onClick: () => void;
  onAnimationComplete?: () => void;
}

export function GameTile({
  emoji,
  gridRow,
  gridCol,
  isSelected,
  isAnimating,
  isFading,
  tileSize,
  gap,
  onClick,
  onAnimationComplete
}: GameTileProps) {
  if (!tileSize) return null;

  return (
    <motion.div
      layout
      initial={{
        x: gridCol * (tileSize + gap),
        y: gridRow * (tileSize + gap),
        opacity: 1
      }}
      animate={{
        x: gridCol * (tileSize + gap),
        y: gridRow * (tileSize + gap),
        opacity: isFading ? 0 : 1
      }}
      onAnimationComplete={onAnimationComplete}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        mass: 0.5
      }}
      className={cn(
        "absolute top-0 left-0 flex items-center justify-center rounded-lg cursor-pointer select-none bg-white border border-gray-200",
        isSelected && "border-blue-500 border-2"
      )}
      style={{
        width: tileSize,
        height: tileSize,
        zIndex: isSelected ? 10 : 1,
        transform: `translate3d(${gridCol * (tileSize + gap)}px, ${gridRow * (tileSize + gap)}px, 0)`
      }}
      onClick={onClick}
    >
      <span className="text-4xl select-none">{emoji}</span>
    </motion.div>
  );
} 