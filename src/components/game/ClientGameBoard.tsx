'use client';

import { Suspense } from 'react';
import { GameBoard } from '@/app/page';
import { LoadingState } from './LoadingState';

export function ClientGameBoard() {
  const today = new Date();
  // Convert to UTC to ensure consistency across timezones
  const date = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];

  return (
    <Suspense fallback={<LoadingState />}>
      <GameBoard date={date} />
    </Suspense>
  );
} 