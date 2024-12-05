import { DailyPuzzle, Emoji, Solution } from '@/types';
import { DIFFICULTY_COLORS } from '@/types/game';
import { getPuzzleNumber } from '@/lib/utils';

export function generateShareText(
  puzzle: DailyPuzzle, 
  solvedGroups: Solution[], 
  maxAttempts: number, 
  attempts: number, 
  guesses: Emoji[][]
): string {
  const puzzleNumber = getPuzzleNumber(puzzle.id);
  
  // Format guesses in reading order
  const guessesStr = (guesses || []).map(guess => {
    // Sort emojis by their position in the original grid
    const sortedGuess = [...guess].sort((a, b) => 
      puzzle.emojis.indexOf(a) - puzzle.emojis.indexOf(b)
    );
    
    // Get colors for each emoji based on its group's difficulty
    const colors = sortedGuess.map(emoji => {
      // Find which group this emoji belongs to
      const group = puzzle.solutions.find(solution => 
        solution.emojis.includes(emoji)
      );
      return DIFFICULTY_COLORS[group?.difficulty ?? 1].emoji; // Default to yellow if no group found
    });

    return colors.join('');
  }).join('\n');

  return `Emoji Connections #${puzzleNumber}

${guessesStr}`;
}

export async function shareResults(shareText: string): Promise<'copied' | 'error'> {
  try {
    await navigator.clipboard.writeText(shareText);
    return 'copied';
  } catch (err) {
    console.error('Failed to copy:', err);
    return 'error';
  }
} 