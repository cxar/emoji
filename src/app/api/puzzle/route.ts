import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { DailyPuzzle } from '@/types';

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  const puzzle = await redis.get<DailyPuzzle>(`puzzle:${date}`);
  
  if (!puzzle) {
    return NextResponse.json({ error: 'No puzzle found for this date' }, { status: 404 });
  }

  return NextResponse.json(puzzle);
} 