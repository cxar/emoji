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
export function seededShuffle<T>(array: T[], seed: string): T[] {
  console.log(`Shuffling array of length ${array.length} with seed ${seed}`);
  const numbers = Array.from(seed).map(char => char.charCodeAt(0));
  let seedNumber = numbers.reduce((acc, num) => acc + num, 0);
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seedNumber = (seedNumber * 1664525 + 1013904223) % 4294967296;
    const j = seedNumber % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  console.log('Shuffle complete');
  return shuffled;
}
