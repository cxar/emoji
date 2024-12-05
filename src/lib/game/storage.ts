import { SavedGameState, STORAGE_KEY } from '@/types/game';
import { Solution } from '@/types';
import { TilePosition } from '@/types/game';

export function loadSavedState(puzzleId: string): SavedGameState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SavedGameState;
      if (parsed.puzzleId === puzzleId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load saved state:', e);
  }
  return null;
}

export function saveGameState(
  puzzleId: string, 
  state: Omit<SavedGameState['state'], 'incorrectGuesses'> & { incorrectGuesses: Set<string> | string[] }, 
  solvedGroups: Solution[], 
  tilePositions: TilePosition[]
) {
  try {
    const saveData: SavedGameState = {
      puzzleId,
      state: {
        ...state,
        incorrectGuesses: Array.isArray(state.incorrectGuesses) 
          ? state.incorrectGuesses 
          : Array.from(state.incorrectGuesses)
      },
      solvedGroups,
      tilePositions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
} 