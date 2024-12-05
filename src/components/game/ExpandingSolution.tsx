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

  return (
    <motion.div
      initial={onAnimationComplete ? { 
        WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 0%, transparent 0%)',
        maskImage: 'radial-gradient(circle at center, black 0%, black 0%, transparent 0%)'
      } : undefined}
      animate={onAnimationComplete ? {
        WebkitMaskImage: 'radial-gradient(circle at center, black 100%, black 100%, transparent 100%)',
        maskImage: 'radial-gradient(circle at center, black 100%, black 100%, transparent 100%)'
      } : undefined}
      onAnimationComplete={onAnimationComplete}
      style={{
        width: "100%",
        borderRadius: "0.5rem",
        position: "absolute",
        left: 0,
        height: rowHeight - gap,
        transform: `translateY(${startRow * rowHeight}px)`,
        ...(onAnimationComplete ? {
          WebkitMaskImage: 'radial-gradient(circle at center, black 0%, black 0%, transparent 0%)',
          maskImage: 'radial-gradient(circle at center, black 0%, black 0%, transparent 0%)'
        } : {
          WebkitMaskImage: 'radial-gradient(circle at center, black 100%, black 100%, transparent 100%)',
          maskImage: 'radial-gradient(circle at center, black 100%, black 100%, transparent 100%)'
        })
      }}
      transition={{ 
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={cn(
        "z-10 flex flex-col items-center justify-center",
        DIFFICULTY_COLORS[solution.difficulty].solved
      )}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <span className="font-bold text-black/80 block text-center">
          {solution.name}
        </span>
        <div className="flex items-center gap-4 mt-1">
          {solution.emojis.map((emoji) => (
            <span key={emoji} className="text-4xl">{emoji}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
} 