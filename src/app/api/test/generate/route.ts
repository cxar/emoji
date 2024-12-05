import { NextRequest, NextResponse } from 'next/server';
import { generatePuzzleWithAI } from '@/lib/puzzleGeneration';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get('date');
    const provider = searchParams.get('provider') as 'claude' | 'openai' | null;

    if (!dateStr) {
      return NextResponse.json({
        success: false,
        error: 'Date parameter is required'
      }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format'
      }, { status: 400 });
    }

    const puzzle = await generatePuzzleWithAI(date, provider || 'claude');
    return NextResponse.json({
      success: true,
      puzzle,
    });
  } catch (error) {
    console.error('Failed to generate test puzzle:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate puzzle'
    }, { status: 500 });
  }
} 