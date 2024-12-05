import { NextResponse } from 'next/server';
import { getTomorrowsPuzzle } from '@/lib/puzzleGeneration';

export async function GET() {
  try {
    // Generate tomorrow's puzzle
    await getTomorrowsPuzzle();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to generate puzzle:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate puzzle' }, { status: 500 });
  }
} 