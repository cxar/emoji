import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DailyPuzzle } from '@/types';

// Game launched on December 1, 2023
const GAME_LAUNCH_DATE = new Date('2023-12-01T12:00:00Z');

export function getPuzzleNumber(date: string): number {
  const puzzleDate = new Date(date + 'T12:00:00Z');
  const diffTime = puzzleDate.getTime() - GAME_LAUNCH_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Add 1 so first puzzle is #1 not #0
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Deterministic shuffle using a seed string
function seededShuffle<T>(array: T[], seed: string): T[] {
  const numbers = Array.from(seed).map(char => char.charCodeAt(0));
  let seedNumber = numbers.reduce((acc, num) => acc + num, 0);
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seedNumber = (seedNumber * 1664525 + 1013904223) % 4294967296;
    const j = seedNumber % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function getTodaysPuzzle(): Promise<DailyPuzzle> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000'
        : '';
        
    const response = await fetch(`${baseUrl}/api/generate-daily`, {
      next: {
        revalidate: 60
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch puzzle');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching puzzle:', error);
    // Fallback puzzle in case of API failure
    const fallbackSolutions = [
      {
        emojis: ['🐶', '🐱', '🐰', '🐹'],
        name: 'Pets',
        difficulty: 1 as const
      },
      {
        emojis: ['🍎', '🍌', '🍇', '🍊'],
        name: 'Fruits',
        difficulty: 2 as const
      },
      {
        emojis: ['⚽️', '🏀', '🎾', '⚾️'],
        name: 'Sports Balls',
        difficulty: 3 as const
      },
      {
        emojis: ['🌞', '🌙', '⭐️', '☁️'],
        name: 'Sky Objects',
        difficulty: 4 as const
      }
    ];

    const today = new Date().toISOString().split('T')[0];
    const allEmojis = fallbackSolutions.flatMap(s => s.emojis);
    
    return {
      id: today,
      generated: new Date().toISOString(),
      solutions: fallbackSolutions,
      emojis: seededShuffle(allEmojis, today) // Use the same seeded shuffle for consistency
    };
  }
}
