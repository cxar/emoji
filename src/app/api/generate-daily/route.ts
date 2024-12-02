import { Redis } from '@upstash/redis';
import { getPuzzleForDate } from '@/lib/puzzleGeneration';

const redis = Redis.fromEnv();

export const runtime = 'edge';

export async function GET() {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Try to get cached puzzle
    const existingPuzzle = await redis.get(`puzzle:${today}`);
    if (existingPuzzle) {
      return new Response(existingPuzzle as string, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate new puzzle if none exists
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const puzzle = await getPuzzleForDate(new Date(), 'openai');

    // Store in Redis with 48-hour expiry
    await redis.set(`puzzle:${today}`, JSON.stringify(puzzle), { ex: 48 * 60 * 60 });

    return new Response(JSON.stringify(puzzle), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to get/generate daily puzzle:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get/generate daily puzzle' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Cron job handler - same as GET but triggered by Vercel Cron
export async function POST() {
  return GET();
}