export type Emoji = string;

export interface Solution {
  emojis: Emoji[];
  name: string;
  difficulty: 1 | 2 | 3 | 4;
}

export interface GameState {
  selected: Emoji[];
  solved: Emoji[][];
  lives: number;
  score: number;
  gameOver: boolean;
}

export interface DailyPuzzle {
  id: string; // Format: YYYY-MM-DD
  generated: string; // ISO timestamp
  solutions: Solution[];
  emojis: Emoji[]; // Pre-shuffled emoji array
}

export function getPuzzleId() {
  const now = new Date();
  // If it's before noon UTC, show yesterday's puzzle
  // This ensures everyone gets ~24 hours to solve each puzzle
  const puzzleDate = new Date(now);
  if (now.getUTCHours() < 12) {
    puzzleDate.setUTCDate(puzzleDate.getUTCDate() - 1);
  }
  return puzzleDate.toISOString().split("T")[0]; // YYYY-MM-DD
}
