'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyPuzzle, Emoji, Solution } from '@/types';
import { cn, getPuzzleNumber } from '@/lib/utils';
import { GameTile } from './GameTile';
import { ExpandingSolution } from './ExpandingSolution';
import { TilePosition, calculateReflow, calculateSolutionPositions } from './boardLogic';
import { GameOverModal } from './GameOverModal';

// Color scheme similar to NYT Connections
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

const STORAGE_KEY = 'emoji-connections-state';
const MAX_ATTEMPTS = 4;

interface BoardGameState {
  selected: Emoji[];
  lives: number;
  gameOver: boolean;
  guesses: Emoji[][];
  incorrectGuesses: Set<string>;
}

const initialGameState: BoardGameState = {
  selected: [],
  lives: MAX_ATTEMPTS,
  gameOver: false,
  guesses: [],
  incorrectGuesses: new Set()
};

interface SavedGameState {
  puzzleId: string;
  state: BoardGameState;
  solvedGroups: Solution[];
}

function generateShareText(puzzle: DailyPuzzle, solvedGroups: Solution[], maxAttempts: number, attempts: number, guesses: Emoji[][]): string {
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

function loadSavedState(puzzleId: string): SavedGameState | null {
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

function saveGameState(puzzleId: string, state: BoardGameState, solvedGroups: Solution[]) {
  try {
    const saveData: SavedGameState = {
      puzzleId,
      state,
      solvedGroups
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

// Helper to convert emoji array to consistent string key
function getGuessKey(emojis: Emoji[]): string {
  return [...emojis].sort().join(',');
}

export function Board({ puzzle }: { puzzle: DailyPuzzle }) {
  const [gameState, setGameState] = useState<BoardGameState>(initialGameState);
  const [solvedGroups, setSolvedGroups] = useState<Solution[]>([]);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'copy' | 'copied'>('copy');
  const [shakeKey, setShakeKey] = useState(0);
  const [tilePositions, setTilePositions] = useState<TilePosition[]>([]);
  const [expandingSolution, setExpandingSolution] = useState<{
    group: Solution;
    startRow: number;
  } | null>(null);
  const [completedSolutions, setCompletedSolutions] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const isRevealingRef = useRef(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [solvedGroupsAtGameOver, setSolvedGroupsAtGameOver] = useState<number | null>(null);

  // Initialize tile positions
  useEffect(() => {
    if (!boardRef.current) return;
    
    const positions: TilePosition[] = puzzle.emojis.map((emoji, index) => ({
      emoji,
      gridRow: Math.floor(index / 4),
      gridCol: index % 4,
      isSelected: false,
      isAnimating: false
    }));

    setTilePositions(positions);
  }, [puzzle.emojis]);

  // Update selection state
  useEffect(() => {
    setTilePositions(prev => 
      prev.map(tile => ({
        ...tile,
        isSelected: gameState.selected.includes(tile.emoji)
      }))
    );
  }, [gameState.selected]);

  const handleShare = async () => {
    const shareText = generateShareText(
      puzzle,
      solvedGroups,
      MAX_ATTEMPTS,
      gameState.lives,
      gameState.guesses || []
    );

    try {
      await navigator.clipboard.writeText(shareText);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('copy'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const animateToSolution = async (matchedEmojis: Emoji[], solutionIndex: number) => {
    if (!boardRef.current) return;

    // Find the actual solution being matched
    const matchingSolution = puzzle.solutions.find(solution =>
      matchedEmojis.every(e => solution.emojis.includes(e))
    )!;

    // Calculate target row based on solved groups
    const targetRow = solvedGroups.length;

    // Move tiles to form solution
    setTilePositions(prev => 
      calculateSolutionPositions(prev, matchedEmojis, targetRow)
    );

    // Wait for tiles to reach their positions
    await new Promise(resolve => setTimeout(resolve, 300));

    // Show the expanding solution
    setExpandingSolution({
      group: matchingSolution,
      startRow: targetRow
    });

    // Wait for expansion animation to complete
    await new Promise(resolve => setTimeout(resolve, 800));

    // Add to solved groups and reflow remaining tiles
    setSolvedGroups(prev => [...prev, matchingSolution]);
    setTilePositions(prev => {
      // Remove matched tiles
      const remainingTiles = prev.filter(tile => !matchedEmojis.includes(tile.emoji));
      // Calculate new positions for remaining tiles, starting after the new solution
      return calculateReflow(remainingTiles, targetRow + 1);
    });
  };

  const revealUnsolvedGroups = async () => {
    // Get unsolved groups in order of difficulty
    const unsolvedGroups = puzzle.solutions
      .filter(solution => !solvedGroups.some(solved => solved.name === solution.name))
      .sort((a, b) => a.difficulty - b.difficulty);

    // Reveal each group in sequence
    for (const solution of unsolvedGroups) {
      // Move tiles to solution positions
      setTilePositions(prev => {
        const remainingTiles = prev.filter(tile => 
          !solvedGroups.flatMap(s => s.emojis).includes(tile.emoji)
        );
        return calculateSolutionPositions(remainingTiles, solution.emojis, solvedGroups.length, true);
      });

      // Wait for tiles to move
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show expanding solution
      setExpandingSolution({
        group: solution,
        startRow: solvedGroups.length
      });

      // Wait for expansion animation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Add to solved groups
      setSolvedGroups(prev => [...prev, solution]);
      
      // Clear expanding solution and wait before next group
      setExpandingSolution(null);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const boardHeight = boardRef.current?.getBoundingClientRect().height ?? 0;
  const boardWidth = boardRef.current?.getBoundingClientRect().width ?? 0;
  const tileSize = (boardWidth - 24) / 4;
  const gap = 8;

  const handleTileClick = async (emoji: Emoji) => {
    if (gameState.gameOver || isRevealing || solvedGroups.some(group => group.emojis.includes(emoji))) {
      return;
    }

    if (gameState.selected.includes(emoji)) {
      setGameState(prev => ({
        ...prev,
        selected: prev.selected.filter(e => e !== emoji)
      }));
      return;
    }

    if (gameState.selected.length >= 4) {
      return;
    }

    setGameState(prev => ({
      ...prev,
      selected: [...prev.selected, emoji]
    }));
  };

  // Handle submit button click
  const handleSubmit = async () => {
    if (gameState.selected.length !== 4) return;
    
    const newSelected = gameState.selected;
    const guessKey = getGuessKey(newSelected);
    
    if (gameState.incorrectGuesses.has(guessKey)) {
      setShowMessage("Already Guessed");
      setTimeout(() => setShowMessage(null), 1500);
      setGameState(prev => ({ ...prev, selected: [] }));
      return;
    }

    const matchingSolution = puzzle.solutions.find(solution =>
      newSelected.every(e => solution.emojis.includes(e)) &&
      solution.emojis.every(e => newSelected.includes(e))
    );

    if (matchingSolution) {
      if (completedSolutions.has(matchingSolution.name)) {
        setGameState(prev => ({ ...prev, selected: [] }));
        return;
      }

      await animateToSolution(newSelected, completedSolutions.size);
      setCompletedSolutions(prev => new Set([...prev, matchingSolution.name]));
      setGameState(prev => ({
        ...prev,
        selected: [],
        guesses: [...prev.guesses, newSelected],
        gameOver: completedSolutions.size + 1 === puzzle.solutions.length
      }));
    } else {
      const isOneAway = puzzle.solutions.some(solution => {
        const matches = newSelected.filter(emoji => 
          solution.emojis.includes(emoji)
        ).length;
        return matches === 3;
      });

      if (isOneAway) {
        setShowMessage("One away!");
        setTimeout(() => setShowMessage(null), 1500);
      }

      setShakeKey(prev => prev + 1);
      const newLives = gameState.lives - 1;
      setGameState(prev => ({
        ...prev,
        selected: [],
        guesses: [...prev.guesses, newSelected],
        incorrectGuesses: new Set([...prev.incorrectGuesses, guessKey]),
        lives: newLives
      }));
    }
  };

  // Check if game is over
  useEffect(() => {
    console.log('Game over check - lives:', gameState.lives, 'gameOver:', gameState.gameOver);
    if (gameState.lives === 0 && !gameState.gameOver && !isRevealingRef.current) {
      console.log('Game Over triggered');
      isRevealingRef.current = true;
      setIsRevealing(true);
      // Store the number of solved groups at time of loss
      setSolvedGroupsAtGameOver(solvedGroups.length);
      
      // Get unsolved groups in order of difficulty
      const unsolvedGroups = puzzle.solutions
        .filter(solution => !solvedGroups.some(solved => solved.name === solution.name))
        .sort((a, b) => a.difficulty - b.difficulty);
      
      console.log('Unsolved groups:', unsolvedGroups);

      const revealNextGroup = async (index: number) => {
        if (index >= unsolvedGroups.length) {
          setGameState(prev => ({ ...prev, gameOver: true }));
          isRevealingRef.current = false;
          setIsRevealing(false);
          setShowGameOver(true);
          return;
        }

        const group = unsolvedGroups[index];
        const currentRow = solvedGroups.length + index;

        // Move tiles for this group into position
        setTilePositions(prev => {
          const remainingTiles = prev.filter(tile => 
            !solvedGroups.flatMap(s => s.emojis).includes(tile.emoji) &&
            !unsolvedGroups.slice(0, index).flatMap(s => s.emojis).includes(tile.emoji)
          );

          // Get tiles for current group
          const groupTiles = remainingTiles.filter(tile => 
            group.emojis.includes(tile.emoji)
          );

          // Center the group horizontally
          const startCol = (4 - groupTiles.length) / 2;
          
          const positionedGroupTiles = groupTiles.map((tile, i) => ({
            ...tile,
            gridRow: currentRow,
            gridCol: startCol + i,
            isAnimating: true
          }));

          // Keep solved tiles and previously positioned tiles
          const solvedTiles = prev.filter(tile => 
            solvedGroups.some(g => g.emojis.includes(tile.emoji)) ||
            unsolvedGroups.slice(0, index).flatMap(s => s.emojis).includes(tile.emoji)
          );

          // Position remaining unmatched tiles below
          const unpositionedTiles = remainingTiles.filter(tile => 
            !group.emojis.includes(tile.emoji)
          ).map((tile, i) => ({
            ...tile,
            gridRow: currentRow + 1 + Math.floor(i / 4),
            gridCol: i % 4,
            isAnimating: true
          }));

          return [...solvedTiles, ...positionedGroupTiles, ...unpositionedTiles];
        });

        // Wait for tiles to move
        await new Promise(resolve => setTimeout(resolve, 500));

        // Show expanding solution and add to solved groups
        setSolvedGroups(prev => [...prev, group]);

        // Wait before next group
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Move to next group
        revealNextGroup(index + 1);
      };

      // Start the reveal sequence
      setTimeout(() => revealNextGroup(0), 500);
    }
  }, [gameState.lives, gameState.gameOver, puzzle.solutions, solvedGroups]);

  // Remove the auto-show effect
  useEffect(() => {
    if (gameState.gameOver && !showGameOver && !isRevealing) {
      setShowGameOver(true);
    }
  }, [gameState.gameOver, showGameOver, isRevealing]);

  // Add a debug effect for lives
  useEffect(() => {
    console.log('Lives:', gameState.lives);
  }, [gameState.lives]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col min-h-0">
      <GameOverModal
        isOpen={showGameOver}
        onClose={() => setShowGameOver(false)}
        solvedGroups={solvedGroups}
        solvedGroupsAtGameOver={solvedGroupsAtGameOver}
        totalGroups={puzzle.solutions.length}
        didWin={solvedGroups.length === puzzle.solutions.length && gameState.lives > 0}
        onShare={handleShare}
        shareStatus={shareStatus}
        shareText={generateShareText(
          puzzle,
          solvedGroups,
          MAX_ATTEMPTS,
          gameState.lives,
          gameState.guesses || []
        )}
      />

      {/* Message overlay */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed inset-x-0 top-[20%] flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-white/95 text-gray-900 px-6 py-2 rounded-lg shadow-lg text-lg font-medium backdrop-blur-sm border border-gray-200">
              {showMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game board */}
      <div 
        ref={boardRef}
        className="relative w-full aspect-square"
      >
        {/* Solutions */}
        <AnimatePresence mode="wait">
          {solvedGroups.map((group, index) => (
            <ExpandingSolution
              key={`solution-${group.name}`}
              solution={group}
              startRow={index}
              boardHeight={boardHeight}
            />
          ))}
        </AnimatePresence>

        <motion.div
          key={shakeKey}
          animate={shakeKey ? {
            x: [0, -10, 10, -10, 10, 0]
          } : undefined}
          transition={{ 
            duration: 0.4, 
            ease: "easeInOut",
            times: [0, 0.2, 0.4, 0.6, 0.8, 1]
          }}
          className="relative w-full h-full"
        >
          <AnimatePresence mode="sync">
            {tilePositions.map((tile) => (
              <GameTile
                key={tile.emoji}
                {...tile}
                tileSize={tileSize}
                gap={gap}
                isFading={solvedGroups.some(group => group.emojis.includes(tile.emoji))}
                onClick={() => handleTileClick(tile.emoji)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Game controls */}
      <div className="mt-4 flex justify-center gap-4">
        <button
          onClick={() => {
            const remainingTiles = tilePositions.filter(
              tile => !solvedGroups.some(group => group.emojis.includes(tile.emoji))
            );

            // Simple shuffle of remaining tiles
            const shuffled = remainingTiles
              .map(value => ({ value, sort: Math.random() }))
              .sort((a, b) => a.sort - b.sort)
              .map(({ value }) => value);

            // Assign new positions
            const newTiles = shuffled.map((tile, index) => ({
              ...tile,
              gridRow: Math.floor(index / 4) + solvedGroups.length,
              gridCol: index % 4,
              isAnimating: true
            }));

            // Keep solved tiles and add shuffled ones
            const solvedTiles = tilePositions.filter(
              tile => solvedGroups.some(group => group.emojis.includes(tile.emoji))
            );

            setTilePositions([...solvedTiles, ...newTiles]);
          }}
          disabled={solvedGroups.length === puzzle.solutions.length || gameState.lives === 0 || isRevealing}
          className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Shuffle
        </button>
        <button
          onClick={() => setGameState(prev => ({ ...prev, selected: [] }))}
          disabled={gameState.selected.length === 0 || isRevealing}
          className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Deselect All
        </button>
        <button
          onClick={handleSubmit}
          disabled={gameState.selected.length !== 4 || isRevealing}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>

      {/* Game status */}
      <div className="mt-4">
        {gameState.gameOver ? (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setShowGameOver(true)}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg 
                       transition-colors flex items-center gap-2"
            >
              <span>View Results</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-medium mr-2">Mistakes remaining:</span>
            <div className="flex gap-2 w-[5.5rem] justify-start">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    visibility: i < gameState.lives ? 'visible' : 'hidden'
                  }}
                >
                  <div className="w-full h-full rounded-full bg-gray-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
