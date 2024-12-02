import { NextResponse } from 'next/server';
import { getTomorrowsPuzzle } from '@/lib/puzzleGeneration';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if we already have tomorrow's puzzle
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const puzzleId = tomorrow.toISOString().split('T')[0];
    
    const existingPuzzle = await redis.get(`puzzle:${puzzleId}`);
    if (existingPuzzle) {
      return new NextResponse('Puzzle already exists for tomorrow', { status: 200 });
    }

    // Generate tomorrow's puzzle 
    await getTomorrowsPuzzle('openai');
    return new NextResponse('Tomorrow\'s puzzle generated successfully', { status: 200 });
  } catch (error) {
    console.error('Failed to generate tomorrow\'s puzzle:', error);
    return new NextResponse('Failed to generate puzzle', { status: 500 });
  }
} 