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
import { BoardGameState, MAX_ATTEMPTS, ANIMATION_TIMINGS, BOARD_CONFIG } from '@/types/game';

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
  group: Solution;
  startRow: number;
  onComplete?: () => void;
}

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
      group: solution,
      startRow: row,
      onComplete: () => {
        onComplete?.();
        setExpandingSolution(null);
        setIsAnimating(false);
      }
    });
  };

  const handleSubmit = async () => {
    if (gameState.selected.length !== 4) return;
    
    const newSelected = gameState.selected;
    const guessKey = getGuessKey(newSelected);
    
    if (gameState.incorrectGuesses.has(guessKey)) {
      setShowMessage("Already Guessed");
      setTimeout(() => setShowMessage(null), ANIMATION_TIMINGS.MESSAGE_DISPLAY);
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

      // Deselect tiles before animation
      setGameState(prev => ({ ...prev, selected: [] }));

      await animateToSolution(
        tilePositions,
        newSelected,
        [...solvedGroups, matchingSolution],
        handleTilePositionsUpdate,
        handleSolutionExpand,
        (solution) => {
          setSolvedGroups(prev => [...prev, matchingSolution]);
          setCompletedSolutions(prev => new Set([...prev, matchingSolution.name]));
          setGameState(prev => ({
            ...prev,
            guesses: [...prev.guesses, newSelected],
            gameOver: completedSolutions.size + 1 === puzzle.solutions.length
          }));
        }
      );
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

  // Update positions after solution is complete
  useEffect(() => {
    if (expandingSolution) {
      const newPositions = calculateBoardPositions(tilePositions, solvedGroups);
      setTilePositions(newPositions);
    }
  }, [expandingSolution, solvedGroups]);

  // Update tile positions when a solution is found
  const handleSolutionFound = (solution: Solution) => {
    const solutionRow = solvedGroups.length;
    
    // Update solved tiles to their final positions
    const updatedPositions = tilePositions.map(tile => {
      if (solution.emojis.includes(tile.emoji)) {
        return {
          ...tile,
          gridRow: solutionRow,
          isAnimating: false,
          isSelected: false
        };
      }
      return tile;
    });

    setTilePositions(updatedPositions);
  };

  // Add effect to handle solution completion
  useEffect(() => {
    if (expandingSolution) {
      handleSolutionFound(expandingSolution.group);
    }
  }, [expandingSolution]);

  // Game over effect
  useEffect(() => {
    const handleGameOver = async () => {
      if (isRevealingRef.current || isAnimating) return;
      
      isRevealingRef.current = true;
      setSolvedGroupsAtGameOver(solvedGroups.length);
      
      // Ensure deselection persists
      const deselectedPositions = tilePositions.map(tile => ({
        ...tile,
        isSelected: false,
        isAnimating: false
      }));
      setTilePositions(deselectedPositions);
      setGameState(prev => ({ ...prev, selected: [], gameOver: true }));
      console.log('Dispatching game over event (loss)');
      const gameOverEvent = new Event('gameOver');
      window.dispatchEvent(gameOverEvent);
      
      // Add a small pause before starting reveal animations
      await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SOLUTION_PAUSE));
      
      await revealUnsolvedGroups(
        puzzle,
        solvedGroups,
        deselectedPositions,
        handleTilePositionsUpdate,
        handleSolutionExpand,
        (solution) => {
          setSolvedGroups(prev => [...prev, solution]);
          if (solvedGroups.length + 1 === puzzle.solutions.length) {
            isRevealingRef.current = false;
            setIsRevealing(false);
          }
        }
      );

      // Show share modal after all reveals are complete
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
      setGameState(prev => ({ ...prev, gameOver: true }));
      console.log('Dispatching game over event (win)');
      const gameOverEvent = new Event('gameOver');
      window.dispatchEvent(gameOverEvent);
      // Ensure deselection on win
      setTilePositions(prev => prev.map(tile => ({
        ...tile,
        isSelected: false,
        isAnimating: false
      })));
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
        {/* Solutions */}
        <AnimatePresence mode="popLayout">
          {solvedGroups.map((group, index) => (
            <ExpandingSolution
              key={`solution-${group.name}-${group.difficulty}`}
              solution={group}
              startRow={index}
              boardHeight={boardDimensions.height}
            />
          ))}
          {expandingSolution && (
            <ExpandingSolution
              key={`expanding-${expandingSolution.group.name}-${expandingSolution.group.difficulty}`}
              solution={expandingSolution.group}
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
