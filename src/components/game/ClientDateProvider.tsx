'use client';

import { createContext, useContext, ReactNode } from 'react';

const DateContext = createContext<string>('');

export function ClientDateProvider({ children }: { children: ReactNode }) {
  const today = new Date();
  // Convert to UTC to ensure consistency across timezones
  const date = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];

  return (
    <DateContext.Provider value={date}>
      {children}
    </DateContext.Provider>
  );
}

export function useGameDate() {
  return useContext(DateContext);
} 