'use client';

import { useState, useEffect } from 'react';

export function ClientDailyMessage() {
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    const handleGameOver = () => {
      console.log('Game over event received');
      setIsGameOver(true);
    };

    // Listen for both custom event and state changes
    window.addEventListener('gameOver', handleGameOver);
    
    // Check initial game state from localStorage
    const savedState = localStorage.getItem('emoji-connections-state');
    if (savedState) {
      try {
        const { state } = JSON.parse(savedState);
        if (state.gameOver) {
          console.log('Found game over state in storage');
          setIsGameOver(true);
        }
      } catch (e) {
        console.error('Error parsing saved state:', e);
      }
    }

    return () => window.removeEventListener('gameOver', handleGameOver);
  }, []);

  return (
    <p className="text-xs sm:text-sm text-gray-500">
      {isGameOver ? "Come back tomorrow 😋" : "New puzzle every day"}
    </p>
  );
} 