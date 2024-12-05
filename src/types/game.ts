import { Emoji, Solution } from './index';

export interface BoardGameState {
  selected: Emoji[];
  lives: number;
  gameOver: boolean;
  guesses: Emoji[][];
  incorrectGuesses: Set<string>;
}

export interface SavedGameState {
  puzzleId: string;
  state: Omit<BoardGameState, 'incorrectGuesses'> & {
    incorrectGuesses: string[];
  };
  solvedGroups: Solution[];
  tilePositions: TilePosition[];
}

export interface TilePosition {
  emoji: Emoji;
  gridRow: number;
  gridCol: number;
  isSelected: boolean;
  isAnimating: boolean;
}

export const DIFFICULTY_COLORS = {
  1: {
    base: 'bg-yellow-100',
    solved: 'bg-yellow-200',
    emoji: '🟨'
  },
  2: {
    base: 'bg-green-100',
    solved: 'bg-green-200',
    emoji: '🟩'
  },
  3: {
    base: 'bg-blue-100',
    solved: 'bg-blue-200',
    emoji: '🟦'
  },
  4: {
    base: 'bg-purple-100',
    solved: 'bg-purple-200',
    emoji: '🟪'
  }
} as const;

export const MAX_ATTEMPTS = 4;

export const ANIMATION_TIMINGS = {
  SHAKE: 400,
  MESSAGE_DISPLAY: 1500,
  TILE_MOVEMENT: 300,
  SOLUTION_REVEAL: 500,
  SOLUTION_PAUSE: 300,
  SHARE_MODAL_DELAY: 1000,
  COPIED_FEEDBACK: 2000,
} as const;

export const BOARD_CONFIG = {
  GRID_SIZE: 4,
  TILE_GAP: 8,
  BOARD_PADDING: 24,
} as const;

export const STORAGE_KEY = 'emoji-connections-state'; 