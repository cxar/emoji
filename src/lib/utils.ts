import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DailyPuzzle } from '@/types';

// Game launched on December 2, 2024
const GAME_LAUNCH_DATE = new Date('2024-12-02T12:00:00Z');

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
}
