import { Emoji, Solution } from "@/types";

export interface TilePosition {
  emoji: Emoji;
  gridRow: number;
  gridCol: number;
  isSelected: boolean;
  isAnimating: boolean;
}

export interface BoardState {
  tiles: TilePosition[];
  expandingSolution: {
    group: Solution;
    startRow: number;
  } | null;
}

interface GridPosition {
  gridRow: number;
  gridCol: number;
}

/**
 * Calculate optimal positions for tiles to flow into a compact grid
 */
export function calculateReflow(tiles: TilePosition[], startRow: number): TilePosition[] {
  // Sort tiles by current position (top to bottom, left to right)
  const sortedTiles = [...tiles].sort((a, b) => {
    if (a.gridRow === b.gridRow) {
      return a.gridCol - b.gridCol;
    }
    return a.gridRow - b.gridRow;
  });

  // Simply assign new positions sequentially, starting from the specified row
  return sortedTiles.map((tile, index) => ({
    ...tile,
    gridRow: Math.floor(index / 4) + startRow,
    gridCol: index % 4,
    isAnimating: true
  }));
}

/**
 * Calculate optimal positions for tiles moving to form a solution
 */
export function calculateSolutionPositions(
  tiles: TilePosition[],
  matchedEmojis: Emoji[],
  targetRow: number,
  isGameOver: boolean = false
): TilePosition[] {
  // First, handle the matched tiles
  const matchedTiles = tiles.filter(tile => matchedEmojis.includes(tile.emoji));
  const remainingTiles = tiles.filter(tile => !matchedEmojis.includes(tile.emoji));
  
  // Calculate center offset to position tiles with proper spacing
  const totalWidth = 4; // 4 tiles wide
  const startCol = (totalWidth - matchedTiles.length) / 2;
  
  // Assign matched tiles to their solution row with centered spacing
  const matchedPositions = matchedTiles.map((tile, index) => ({
    ...tile,
    gridRow: targetRow,
    gridCol: startCol + index,
    isAnimating: true
  }));

  // For game over reveals, we don't need to reflow remaining tiles
  if (isGameOver) {
    return [...matchedPositions, ...remainingTiles];
  }

  // Assign remaining tiles to a compact grid starting after the target row
  const remainingPositions = remainingTiles.map((tile, index) => ({
    ...tile,
    gridRow: Math.floor(index / 4) + targetRow + 1,
    gridCol: index % 4,
    isAnimating: true
  }));

  return [...matchedPositions, ...remainingPositions];
} 