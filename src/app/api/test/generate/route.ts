import { NextResponse } from 'next/server';
import { generatePuzzleWithAI } from '@/lib/puzzleGeneration';

export async function GET(request: Request) {
  try {
    // Get date and provider from query parameters
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const provider = (searchParams.get('provider') || 'claude') as 'claude' | 'openai';
    const date = dateStr ? new Date(dateStr) : new Date();

    // Validate date
    if (isNaN(date.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    // Validate provider
    if (!['claude', 'openai'].includes(provider)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid provider. Use "claude" or "openai"'
      }, { status: 400 });
    }

    const puzzle = await generatePuzzleWithAI(date, provider);
    return NextResponse.json({
      success: true,
      puzzle,
      date: date.toISOString().split('T')[0],
      provider,
      generated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test puzzle generation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 