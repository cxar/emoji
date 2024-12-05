import { Solution } from "@/types";
import { motion } from "framer-motion";
import { DIFFICULTY_COLORS } from "@/types/game";
import { cn } from "@/lib/utils";

interface ExpandingSolutionProps {
  solution: Solution;
  startRow: number;
  boardHeight: number;
  onAnimationComplete?: () => void;
}

export function ExpandingSolution({ 
  solution, 
  startRow, 
  boardHeight,
  onAnimationComplete 
}: ExpandingSolutionProps) {
  const tileSize = (boardHeight - 24) / 4;
  const gap = 8;
  const rowHeight = tileSize + gap;

  // Map difficulty to actual color values
  const bgColors = {
    1: '#fef9c3', // yellow-200
    2: '#bbf7d0', // green-200
    3: '#bfdbfe', // blue-200
    4: '#e9d5ff'  // purple-200
  };

  return (
    <motion.div
      initial={{ 
        WebkitMask: 'radial-gradient(circle at center, black 0%, transparent 0%)',
        mask: 'radial-gradient(circle at center, black 0%, transparent 0%)'
      }}
      animate={{ 
        WebkitMask: 'radial-gradient(circle at center, black 100%, transparent 100%)',
        mask: 'radial-gradient(circle at center, black 100%, transparent 100%)'
      }}
      onAnimationComplete={onAnimationComplete}
      className={cn(
        "absolute top-0 left-0 w-full z-20 flex flex-col items-center justify-center rounded-lg",
        DIFFICULTY_COLORS[solution.difficulty].solved
      )}
      style={{
        height: tileSize + "px",
        transform: `translateY(${startRow * rowHeight}px)`,
        backgroundColor: bgColors[solution.difficulty]
      }}
      transition={{ 
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <span className="font-bold text-black/80 block text-center">
        {solution.name}
      </span>
      <div className="flex items-center gap-4 mt-1">
        {solution.emojis.map((emoji) => (
          <span key={emoji} className="text-4xl">{emoji}</span>
        ))}
      </div>
    </motion.div>
  );
} 