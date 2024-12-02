import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Initialize Redis
const redis = Redis.fromEnv();

export const runtime = 'edge';

export async function GET() {
  try {
    // Test basic Redis connection
    await redis.set('test-key', 'test-value');
    const testValue = await redis.get('test-key');
    
    // Clean up test key
    await redis.del('test-key');
    
    return NextResponse.json({
      success: true,
      message: 'Redis connection successful',
      testValue
    });
  } catch (error) {
    console.error('Redis test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 