'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyPuzzle, Emoji, Solution } from '@/types';
import { TilePosition } from '@/types/game';
import { GameTile } from './GameTile';
import { ExpandingSolution } from './ExpandingSolution';
import { GameOverModal } from './GameOverModal';
import { GameControls } from './GameControls';
import { GameStatus } from './GameStatus';
import { MessageOverlay } from './MessageOverlay';
import { loadSavedState, saveGameState } from '@/lib/game/storage';
import { generateShareText, shareResults } from '@/lib/game/share';
import { animateToSolution, revealUnsolvedGroups, calculateBoardPositions } from '@/lib/game/animations';
import { BoardGameState, MAX_ATTEMPTS, ANIMATION_TIMINGS, BOARD_CONFIG, DIFFICULTY_COLORS } from '@/types/game';
import ReactDOM from 'react-dom';
import { cn } from '@/lib/utils';

const initialGameState: BoardGameState = {
  selected: [],
  lives: MAX_ATTEMPTS,
  gameOver: false,
  guesses: [],
  incorrectGuesses: new Set()
};

// Helper to convert emoji array to consistent string key
function getGuessKey(emojis: Emoji[]): string {
  return [...emojis].sort().join(',');
}

interface ExpandingSolutionState {
  solution: Solution;
  startRow: number;
  onComplete?: () => void;
}

// Add this at the top level of the file, matching ExpandingSolution
const bgColors = {
  1: '#fef9c3', // yellow-200
  2: '#bbf7d0', // green-200
  3: '#bfdbfe', // blue-200
  4: '#e9d5ff'  // purple-200
};

export function Board({ puzzle }: { puzzle: DailyPuzzle }) {
  const [gameState, setGameState] = useState<BoardGameState>(initialGameState);
  const [solvedGroups, setSolvedGroups] = useState<Solution[]>([]);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'copy' | 'copied'>('copy');
  const [shakeKey, setShakeKey] = useState(0);
  const [tilePositions, setTilePositions] = useState<TilePosition[]>([]);
  const [expandingSolution, setExpandingSolution] = useState<ExpandingSolutionState | null>(null);
  const [completedSolutions, setCompletedSolutions] = useState<Set<string>>(new Set());
  const [isRevealing, setIsRevealing] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [solvedGroupsAtGameOver, setSolvedGroupsAtGameOver] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const isRevealingRef = useRef(false);
  const hasInitialized = useRef(false);

  // Load saved state
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    console.log('Initializing board with puzzle:', puzzle);
    const savedState = loadSavedState(puzzle.id);
    if (savedState) {
      console.log('Loading saved state:', savedState);
      setGameState({
        ...savedState.state,
        incorrectGuesses: new Set(savedState.state.incorrectGuesses)
      });
      setSolvedGroups(savedState.solvedGroups);
      setCompletedSolutions(new Set(savedState.solvedGroups.map(g => g.name)));

      // Ensure we have valid tile positions from saved state
      if (savedState.tilePositions && savedState.tilePositions.length > 0) {
        setTilePositions(savedState.tilePositions);
      } else {
        // Fallback to initial grid if saved positions are invalid
        const initialTiles = puzzle.emojis.map((emoji, index) => ({
          emoji,
          gridRow: Math.floor(index / 4),
          gridCol: index % 4,
          isSelected: false,
          isAnimating: false
        }));
        setTilePositions(initialTiles);
      }
    } else {
      console.log('Creating new game state with emojis:', puzzle.emojis);
      // Initialize new game with tiles in a grid
      const initialTiles = puzzle.emojis.map((emoji, index) => ({
        emoji,
        gridRow: Math.floor(index / 4),
        gridCol: index % 4,
        isSelected: false,
        isAnimating: false
      }));
      console.log('Setting initial tile positions:', initialTiles);
      setTilePositions(initialTiles);
    }
  }, [puzzle.id, puzzle.emojis]);

  // Initialize board dimensions
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (boardRef.current) {
        const { width, height } = boardRef.current.getBoundingClientRect();
        setBoardDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const tileSize = (boardDimensions.width - BOARD_CONFIG.BOARD_PADDING) / BOARD_CONFIG.GRID_SIZE;
  const gap = BOARD_CONFIG.TILE_GAP;

  console.log('Board dimensions:', boardDimensions, 'Tile size:', tileSize);

  useEffect(() => {
    console.log('Current tile positions:', tilePositions);
  }, [tilePositions]);

  // Save state on changes
  useEffect(() => {
    if (!hasInitialized.current) return;
    saveGameState(puzzle.id, gameState, solvedGroups, tilePositions);
  }, [puzzle.id, gameState, solvedGroups, tilePositions]);

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
      gameState.guesses
    );

    const result = await shareResults(shareText);
    setShareStatus(result === 'copied' ? 'copied' : 'copy');
    if (result === 'copied') {
      setTimeout(() => setShareStatus('copy'), ANIMATION_TIMINGS.COPIED_FEEDBACK);
    }
  };

  const handleTileClick = (emoji: Emoji) => {
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

  const handleTilePositionsUpdate = (positions: TilePosition[]) => {
    setIsAnimating(true);
    setTilePositions(positions);
  };

  const handleSolutionExpand = (solution: Solution, row: number, onComplete?: () => void) => {
    setExpandingSolution({
      solution,
      startRow: row,
      onComplete
    });
  };

  const handleSubmit = async () => {
    if (gameState.selected.length !== 4) return;
    
    const newSelected = [...gameState.selected];
    const guessKey = getGuessKey(newSelected);
    
    if (gameState.incorrectGuesses.has(guessKey)) {
      setShowMessage("Already tried!");
      setTimeout(() => setShowMessage(null), ANIMATION_TIMINGS.MESSAGE_DISPLAY);
      return;
    }

    // Check if this matches any unsolved group
    const matchingSolution = puzzle.solutions.find(solution => {
      if (solvedGroups.some(solved => solved.name === solution.name)) {
        return false;
      }
      return getGuessKey(solution.emojis) === guessKey;
    });

    if (matchingSolution) {
      setIsAnimating(true);
      
      // Clear selection state immediately
      setGameState(prev => ({
        ...prev,
        selected: []
      }));
      
      // Move tiles to position first
      const newPositions = calculateBoardPositions(
        tilePositions.map(tile => ({
          ...tile,
          isSelected: false,
          isAnimating: false
        })),
        solvedGroups,
        matchingSolution.emojis
      );
      setTilePositions(newPositions);

      // Wait for movement animation then show reveal
      await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.TILE_MOVEMENT));
      
      // Do the reveal animation and update state only after it completes
      await new Promise<void>(resolve => {
        handleSolutionExpand(matchingSolution, solvedGroups.length, () => {
          const newGameState = {
            ...gameState,
            selected: [],
            guesses: [...gameState.guesses, newSelected]
          };

          // Update game state first
          setGameState(newGameState);
          setIsAnimating(false);

          // Save state after successful guess
          saveGameState(
            puzzle.id,
            newGameState,
            [...solvedGroups, matchingSolution],
            newPositions
          );

          // Wait a frame before updating solved groups to prevent overlap
          requestAnimationFrame(() => {
            setSolvedGroups(prev => [...prev, matchingSolution]);
            setCompletedSolutions(prev => new Set([...prev, matchingSolution.name]));
            setExpandingSolution(null);
          });

          resolve();
        });
      });
    } else {
      const isOneAway = puzzle.solutions.some(solution => {
        const matches = newSelected.filter(emoji => 
          solution.emojis.includes(emoji)
        ).length;
        return matches === 3;
      });

      if (isOneAway) {
        setShowMessage("One away!");
        setTimeout(() => setShowMessage(null), ANIMATION_TIMINGS.MESSAGE_DISPLAY);
      }

      const newLives = gameState.lives - 1;
      
      // Start shake animation
      setShakeKey(prev => prev + 1);
      
      // Set game state
      setGameState(prev => ({
        ...prev,
        selected: [],
        guesses: [...prev.guesses, newSelected],
        incorrectGuesses: new Set([...prev.incorrectGuesses, guessKey]),
        lives: newLives,
      }));

      // If this was the last life, wait for shake animation to complete before setting isRevealing
      if (newLives === 0) {
        await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SHAKE));
        setIsRevealing(true);
      }
    }
  };

  const handleShuffle = () => {
    if (isAnimating || isRevealing) return;

    setIsAnimating(true);

    // Get unsolved tiles
    const unsolvedTiles = tilePositions.filter(
      tile => !solvedGroups.some(group => group.emojis.includes(tile.emoji))
    );

    // Shuffle only unsolved tiles while preserving tile properties
    const shuffled = unsolvedTiles
      .map(tile => ({ tile, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ tile }, index) => ({
        ...tile,
        gridRow: Math.floor(index / 4) + solvedGroups.length,
        gridCol: index % 4,
        isAnimating: true
      }));

    // Get solved tiles with their original properties
    const solvedTiles = tilePositions.filter(
      tile => solvedGroups.some(group => group.emojis.includes(tile.emoji))
    ).map(tile => ({
      ...tile,
      isAnimating: false
    }));

    // Combine and set new positions
    const newPositions = [...solvedTiles, ...shuffled];
    setTilePositions(newPositions);

    // Reset animation state after animation completes
    setTimeout(() => {
      setTilePositions(prev => prev.map(tile => ({ ...tile, isAnimating: false })));
      setIsAnimating(false);
    }, ANIMATION_TIMINGS.TILE_MOVEMENT);
  };

  // Single effect to handle tile positioning
  useEffect(() => {
    if (expandingSolution?.solution) {
      const updatedPositions = tilePositions.map(tile => ({
        ...tile,
        isAnimating: false,
        isSelected: false
      }));

      setTilePositions(updatedPositions);
    }
  }, [expandingSolution]);

  // Game over effect
  useEffect(() => {
    const handleGameOver = async () => {
      if (isRevealingRef.current || isAnimating) return;
      
      isRevealingRef.current = true;
      setIsRevealing(true);
      setSolvedGroupsAtGameOver(solvedGroups.length);
      
      // Ensure deselection persists
      const deselectedPositions = tilePositions.map(tile => ({
        ...tile,
        isSelected: false,
        isAnimating: false
      }));
      setTilePositions(deselectedPositions);
      setGameState(prev => ({ ...prev, selected: [], gameOver: true }));
      
      // Add a small pause before starting reveal animations
      await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SOLUTION_PAUSE));
      
      // Sort all solutions by difficulty to ensure correct row placement
      const unsolvedGroups = puzzle.solutions
        .filter(solution => !solvedGroups.some(solved => solved.name === solution.name))
        .sort((a, b) => a.difficulty - b.difficulty);

      // Keep track of all solutions for position calculation
      let revealedSolutions = [...solvedGroups];
      
      for (const solution of unsolvedGroups) {
        // Calculate positions based on all revealed solutions so far
        const newPositions = calculateBoardPositions(
          tilePositions,
          revealedSolutions,
          solution.emojis
        );
        setTilePositions(newPositions);

        // Wait for movement animation
        await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.TILE_MOVEMENT));

        // Show the reveal animation
        await new Promise<void>(resolve => {
          handleSolutionExpand(solution, revealedSolutions.length, resolve);
        });

        // Update both the state and our local tracking
        revealedSolutions = [...revealedSolutions, solution];
        setSolvedGroups(revealedSolutions);

        // Wait before next reveal
        await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SOLUTION_PAUSE));
      }

      isRevealingRef.current = false;
      setIsRevealing(false);
      
      setTimeout(() => {
        setShowGameOver(true);
      }, ANIMATION_TIMINGS.SHARE_MODAL_DELAY);
    };

    if (gameState.lives === 0 && !gameState.gameOver && isRevealing) {
      handleGameOver();
    }
  }, [gameState.lives, gameState.gameOver, puzzle.solutions, solvedGroups, isAnimating, isRevealing]);

  // Handle win condition
  useEffect(() => {
    if (solvedGroups.length === puzzle.solutions.length && !gameState.gameOver) {
      // Deselect tiles and prepare for animation
      const deselectedPositions = tilePositions.map(tile => ({
        ...tile,
        isSelected: false,
        isAnimating: false
      }));
      setTilePositions(deselectedPositions);
      
      setGameState(prev => ({ ...prev, gameOver: true }));
      console.log('Dispatching game over event (win)');
      const gameOverEvent = new Event('gameOver');
      window.dispatchEvent(gameOverEvent);
      
      // Show game over modal after a short delay
      setTimeout(() => {
        setShowGameOver(true);
      }, ANIMATION_TIMINGS.SOLUTION_PAUSE);
    }
  }, [solvedGroups.length, puzzle.solutions.length, gameState.gameOver]);

  // Remove the automatic game over modal trigger since we handle it in the reveal callback
  useEffect(() => {
    if (gameState.gameOver && !showGameOver && !isRevealing && gameState.lives > 0) {
      // Only show immediately for wins, not for losses (handled in reveal callback)
      setShowGameOver(true);
    }
  }, [gameState.gameOver, showGameOver, isRevealing, gameState.lives]);

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
          gameState.guesses
        )}
      />

      <MessageOverlay message={showMessage} />

      {/* Game board */}
      <div 
        ref={boardRef}
        className="relative w-full aspect-square bg-gray-50"
      >
        {solvedGroups.map((group, index) => (
          <div
            key={`static-${group.name}`}
            className="absolute top-0 left-0 w-full flex flex-col items-center justify-center z-10 rounded-lg"
            style={{
              height: tileSize + "px",
              transform: `translateY(${index * (tileSize + gap)}px)`,
              backgroundColor: bgColors[group.difficulty]
            }}
          >
            <span className="font-bold text-black/80 block text-center">
              {group.name}
            </span>
            <div className="flex items-center gap-4 mt-1">
              {group.emojis.map((emoji) => (
                <span key={emoji} className="text-4xl">{emoji}</span>
              ))}
            </div>
          </div>
        ))}

        <AnimatePresence mode="wait">
          {expandingSolution?.solution && (
            <ExpandingSolution
              key={`expanding-${expandingSolution.solution.name}`}
              solution={expandingSolution.solution}
              startRow={expandingSolution.startRow}
              boardHeight={boardDimensions.height}
              onAnimationComplete={expandingSolution.onComplete}
            />
          )}
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

      <GameControls
        onShuffle={handleShuffle}
        onDeselectAll={() => setGameState(prev => ({ ...prev, selected: [] }))}
        onSubmit={handleSubmit}
        selectedCount={gameState.selected.length}
        isDisabled={isRevealing}
        solvedGroupsCount={solvedGroups.length}
        totalGroups={puzzle.solutions.length}
      />

      <GameStatus
        isGameOver={gameState.gameOver}
        onShowResults={() => setShowGameOver(true)}
        lives={gameState.lives}
        maxAttempts={MAX_ATTEMPTS}
      />
    </div>
  );
}
