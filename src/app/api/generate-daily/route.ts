import { NextResponse } from 'next/server';
import { getTodaysPuzzle } from '@/lib/puzzleGeneration';

export const runtime = 'edge';

export async function GET() {
  try {
    const puzzle = await getTodaysPuzzle();
    return NextResponse.json(puzzle);
  } catch (error) {
    console.error('Failed to generate daily puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily puzzle' },
      { status: 500 }
    );
  }
}

// Cron job handler - same as GET but triggered by Vercel Cron
export async function POST() {
  return GET();
}