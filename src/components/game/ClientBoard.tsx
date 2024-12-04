'use client';

import { useEffect, useState, Suspense } from 'react';
import { Board } from './Board';
import { DailyPuzzle } from '@/types';
import { LoadingState } from './LoadingState';

function getClientDate() {
  const today = new Date();
  return new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];
}

export function ClientBoard() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);

  useEffect(() => {
    const fetchPuzzle = async () => {
      const date = getClientDate();
      const response = await fetch(`/api/puzzle?date=${date}`);
      if (!response.ok) {
        throw new Error('Failed to fetch puzzle');
      }
      const data = await response.json();
      setPuzzle(data);
    };

    fetchPuzzle();
  }, []);

  if (!puzzle) {
    return <LoadingState />;
  }

  return <Board puzzle={puzzle} />;
} 