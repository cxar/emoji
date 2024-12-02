import { Solution } from "@/types";
import { createContext, ReactNode } from "react";

interface GameContextType {
  lives: number;
  maxAttempts: number;
  gameOver: boolean;
  solvedGroups: Solution[];
  totalGroups: number;
  onShare: () => void;
  shareStatus: 'copy' | 'copied';
}

export const GameContext = createContext<GameContextType>({
  lives: 4,
  maxAttempts: 4,
  gameOver: false,
  solvedGroups: [],
  totalGroups: 4,
  onShare: () => {},
  shareStatus: 'copy'
});

interface GameProviderProps {
  children: ReactNode;
  value: GameContextType;
}

export function GameProvider({ children, value }: GameProviderProps) {
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
} 