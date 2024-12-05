import { TilePosition } from '@/types/game';
import { Emoji, Solution } from '@/types';
import { ANIMATION_TIMINGS, BOARD_CONFIG } from '@/types/game';

/**
 * Calculate positions for all tiles on the board
 */
export function calculateBoardPositions(
  tiles: TilePosition[],
  solvedGroups: Solution[],
  movingEmojis: Emoji[] = []
): TilePosition[] {
  // If no solved groups and no moving tiles, maintain current grid
  if (solvedGroups.length === 0 && movingEmojis.length === 0) {
    return tiles;
  }

  // Start with solved groups at the top
  const solvedTiles = tiles
    .filter(tile => solvedGroups.some(group => group.emojis.includes(tile.emoji)))
    .map(tile => {
      const groupIndex = solvedGroups.findIndex(group => group.emojis.includes(tile.emoji));
      return {
        ...tile,
        gridRow: groupIndex,
        gridCol: solvedGroups[groupIndex].emojis.indexOf(tile.emoji),
        isAnimating: false
      };
    });

  // Handle tiles that are currently moving to a solution
  const movingTiles = tiles
    .filter(tile => movingEmojis.includes(tile.emoji))
    .map((tile, i) => ({
      ...tile,
      gridRow: solvedGroups.length,
      gridCol: i,
      isAnimating: true
    }));

  // Remaining tiles flow below in a grid
  const remainingTiles = tiles
    .filter(tile => 
      !solvedGroups.some(group => group.emojis.includes(tile.emoji)) &&
      !movingEmojis.includes(tile.emoji)
    )
    .map((tile, i) => ({
      ...tile,
      gridRow: solvedGroups.length + (movingEmojis.length > 0 ? 1 : 0) + Math.floor(i / 4),
      gridCol: i % 4,
      isAnimating: true
    }));

  return [...solvedTiles, ...movingTiles, ...remainingTiles];
}

export function animateToSolution(
  tilePositions: TilePosition[],
  matchedEmojis: Emoji[],
  solvedGroups: Solution[],
  onPositionsUpdate: (positions: TilePosition[]) => void,
  onSolutionExpand: (solution: Solution, row: number, onComplete: () => void) => void,
  onSolutionComplete: (solution: Solution) => void
) {
  return new Promise<void>(resolve => {
    const matchingSolution = solvedGroups[solvedGroups.length - 1];
    
    // First move tiles into position
    const newPositions = calculateBoardPositions(
      tilePositions,
      solvedGroups.slice(0, -1), // Don't include current solution yet
      matchedEmojis
    );
    onPositionsUpdate(newPositions);

    // After movement animation, show the reveal
    setTimeout(() => {
      onSolutionExpand(matchingSolution, solvedGroups.length - 1, () => {
        onSolutionComplete(matchingSolution);
        resolve();
      });
    }, ANIMATION_TIMINGS.TILE_MOVEMENT);
  });
}

export async function revealUnsolvedGroups(
  puzzle: { solutions: Solution[] },
  solvedGroups: Solution[],
  tilePositions: TilePosition[],
  onPositionsUpdate: (positions: TilePosition[]) => void,
  onSolutionExpand: (solution: Solution, row: number, onComplete: () => void) => void,
  onSolutionComplete: (solution: Solution) => void
) {
  const unsolvedGroups = puzzle.solutions
    .filter(solution => !solvedGroups.some(solved => solved.name === solution.name))
    .sort((a, b) => a.difficulty - b.difficulty);

  let currentGroups = [...solvedGroups];

  for (const solution of unsolvedGroups) {
    // Move tiles into position
    const newPositions = calculateBoardPositions(
      tilePositions,
      currentGroups,
      solution.emojis
    );
    onPositionsUpdate(newPositions);

    // Wait for movement animation
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.TILE_MOVEMENT));

    // Show the reveal
    await new Promise<void>(resolve => {
      onSolutionExpand(solution, currentGroups.length, resolve);
    });

    // Update groups and complete
    currentGroups = [...currentGroups, solution];
    onSolutionComplete(solution);

    // Wait before next reveal
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SOLUTION_PAUSE));
  }
} 