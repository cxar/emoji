import { Redis } from '@upstash/redis';
import { DailyPuzzle, Solution } from "@/types";
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { seededShuffle } from '@/lib/utils';

// Initialize Redis and AI clients
const redis = Redis.fromEnv();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type AIProvider = 'claude' | 'openai';

// Get default provider from environment variable
const DEFAULT_PROVIDER: AIProvider = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || 'openai';

export async function generatePuzzleWithAI(date: Date, provider: AIProvider = DEFAULT_PROVIDER): Promise<Omit<DailyPuzzle, 'id' | 'generated'>> {
  console.log(`Generating puzzle for date ${date} using provider ${provider}`);
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Get recently used emojis
  const recentEmojis = await getAllPuzzleEmojis();
  const recentEmojisStr = recentEmojis.join(', ');



  const prompt = `
**Goal:**  
Generate a single JSON object representing a daily emoji puzzle for ${dateStr}. The puzzle must contain exactly **4 distinct sets** of **4 unique emojis each**, totaling **16 unique emojis**, plus a scrambled \`"emojis"\` array. Each set should lead to a meaningful thematic group that is not too obvious or overused, yet still accessible to the average American solver without requiring niche cultural knowledge.

**IMPORTANT - DO NOT USE THESE EMOJIS:**
The following emojis have been used in recent puzzles and should NOT be used again:
${recentEmojisStr}

**Holiday Integration:**
If ${dateStr} is a major holiday, incorporate that holiday's theme thoughtfully, but avoid the most obvious or overused holiday symbols. Choose creative representations that still maintain the puzzle's challenge.

**Avoid Overused or Obvious Themes:**  
- **No "luck" sets or culturally specific good-luck symbols.** Avoid themes like four-leaf clovers, Chinese red envelopes, or other culturally exclusive signs of fortune.
- **No niche or literary references like Sherlock Holmes.** Avoid themes that require familiarity with specific literary works, obscure historical events, or non-mainstream cultural phenomena.
- **No obvious established sets** (e.g., playing card suits, math symbols, basic shapes, zodiac signs).

**Cultural Accessibility & Everyday Concepts:**  
- Stick to concepts that are common knowledge for the average American. Think of everyday life, widely recognized tools, household objects, common activities, or well-known categories from daily experience (e.g., common kitchen utensils, basic clothing items, widely recognized holiday decorations—if it's a major holiday).
- If referring to holidays, choose globally or nationally recognized holidays and pick symbols that are broadly known (e.g., Jack-o'-lantern for Halloween if it's October 31, but not obscure cultural festival items).
- Use emojis that evoke a concept known to a broad audience without being overly simplistic or obvious.

**Conceptual, Not Purely Visual:**  
- Avoid sets that are immediately obvious by sight alone (e.g., four emojis that look similar or come from the same subset).
- Each group should have a conceptual link that is not too abstract and does not rely on color, shape, or a single category alone. Mix different categories of emojis (objects, foods, symbols, places, etc.) to create a thematic connection.
- Make sure each chosen emoji clearly supports the theme once the solver makes the connection.

**Difficulty Variation (1 to 4):**  
- Difficulty 1: Relatively straightforward but not cliché. Perhaps objects commonly found in a particular room of a house or items associated with a well-known activity (e.g., a simple hobby).
- Difficulty 2: A bit trickier, but still everyday. Maybe items related to a popular form of entertainment, simple common tools for a known task, or items you bring on a certain type of outing.
- Difficulty 3: More challenging, but still everyday or well-known cultural concepts that are not holiday- or luck-based. For example, icons that represent essential stages in a well-known process, or symbols related to a widely known but not obvious category (e.g., various items associated with a typical American pastime).
- Difficulty 4: The toughest but still guessable through common knowledge. Possibly a thematic link that requires a bit of thought, like items indirectly representing a well-known concept (e.g., symbols representing common college subjects, everyday items that share a subtle conceptual link).

**No Duplicate Emojis:**  
- All 16 emojis must be unique across the entire puzzle.

**Clarity & Explanation:**  
- The \`"name"\` of each group should make sense once the solver finds the connection.
- The \`"explanation"\` should be a brief statement confirming why these emojis belong together.

**JSON Output Format Only:**  
Return only one JSON object, structured as follows, with no extra commentary or text outside the object:

{
  "solutions": [
    {
      "emojis": ["emoji1", "emoji2", "emoji3", "emoji4"],
      "name": "Group 1 Title",
      "difficulty": 1,
      "explanation": "Brief explanation."
    },
    {
      "emojis": ["emoji5", "emoji6", "emoji7", "emoji8"],
      "name": "Group 2 Title",
      "difficulty": 2,
      "explanation": "Brief explanation."
    },
    {
      "emojis": ["emoji9", "emoji10", "emoji11", "emoji12"],
      "name": "Group 3 Title",
      "difficulty": 3,
      "explanation": "Brief explanation."
    },
    {
      "emojis": ["emoji13", "emoji14", "emoji15", "emoji16"],
      "name": "Group 4 Title",
      "difficulty": 4,
      "explanation": "Brief explanation."
    }
  ],
  "emojis": ["emoji1", ..., "emoji16"]
}`;

  console.log('Prompt:', prompt);


  let responseText: string;

  if (provider === 'claude') {
    console.log('Using Claude for puzzle generation');
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      console.error('Unexpected non-text response from Claude');
      throw new Error('Expected text response from Claude');
    }
    responseText = content.text;
    console.log('Received response from Claude');
  } else {
    console.log('Using OpenAI for puzzle generation');
    const completion = await openai.chat.completions.create({
      model: "o1-preview",
      temperature: 1,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
    });

    responseText = completion.choices[0].message.content || '';
    console.log('Received response from OpenAI');
  }

  try {
    console.log('Parsing AI response');
    const response = JSON.parse(responseText) as {
      solutions: Array<{
        emojis: string[];
        name: string;
        difficulty: 1 | 2 | 3 | 4;
        explanation: string;
      }>;
    };

    // Validate the response format
    if (!response.solutions || response.solutions.length !== 4) {
      console.error('Invalid puzzle format: incorrect number of solutions');
      throw new Error('Invalid puzzle format from AI');
    }

    // Check for duplicate emojis
    const allEmojis = response.solutions.flatMap(s => s.emojis);
    const uniqueEmojis = new Set(allEmojis);
    if (uniqueEmojis.size !== 16) {
      console.error('Duplicate emojis found in puzzle');
      throw new Error('Duplicate emojis found in puzzle');
    }

    // Check for recently used emojis
    const usedRecentEmojis = allEmojis.filter(emoji => recentEmojis.includes(emoji));
    if (usedRecentEmojis.length > 0) {
      console.error('Recently used emojis found in puzzle:', usedRecentEmojis);
      throw new Error('Recently used emojis found in puzzle');
    }

    // Validate difficulty levels
    const difficulties = new Set(response.solutions.map(s => s.difficulty));
    if (difficulties.size !== 4 || !([1, 2, 3, 4] as const).every(d => difficulties.has(d))) {
      console.error('Invalid difficulty progression');
      throw new Error('Invalid difficulty progression');
    }

    // Use the date string as the seed for consistent shuffling
    const puzzleId = date.toISOString().split('T')[0];
    console.log(`Shuffling emojis with puzzle ID ${puzzleId}`);
    const shuffledEmojis = seededShuffle(allEmojis, puzzleId);

    return {
      solutions: response.solutions.map(({ emojis, name, difficulty }) => ({
        emojis,
        name,
        difficulty
      })),
      emojis: shuffledEmojis
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    throw new Error('Failed to generate valid puzzle');
  }
}

export async function getPuzzleForDate(date: Date, provider: AIProvider = DEFAULT_PROVIDER): Promise<DailyPuzzle> {
  const puzzleId = date.toISOString().split('T')[0];
  console.log(`Getting puzzle for date ${puzzleId}`);
  
  // Check if puzzle exists in Redis
  console.log('Checking Redis for existing puzzle');
  const existingPuzzle = await redis.get<DailyPuzzle>(`puzzle:${puzzleId}`);
  if (existingPuzzle) {
    console.log('Found existing puzzle in Redis');
    if (typeof existingPuzzle === 'string') {
      try {
        const parsed = JSON.parse(existingPuzzle);
        if (parsed?.emojis?.length) {
          console.log('Successfully parsed existing puzzle');
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse puzzle from Redis:', e);
      }
    } else if (existingPuzzle?.emojis?.length) {
      console.log('Using existing puzzle from Redis');
      return existingPuzzle;
    }
  }
  
  // Generate new puzzle with AI
  console.log('Generating new puzzle with AI');
  const puzzleBase = await generatePuzzleWithAI(date, provider);
  const newPuzzle: DailyPuzzle = {
    id: puzzleId,
    generated: new Date().toISOString(),
    solutions: puzzleBase.solutions,
    emojis: puzzleBase.emojis
  };
  
  // Store in Redis with 7-day expiry
  console.log('Storing new puzzle in Redis');
  await redis.set(`puzzle:${puzzleId}`, JSON.stringify(newPuzzle), { ex: 7 * 24 * 60 * 60 });
  
  return newPuzzle;
}

export async function getTodaysPuzzle(provider: AIProvider = DEFAULT_PROVIDER): Promise<DailyPuzzle> {
  return getPuzzleForDate(new Date(), provider);
}

export async function getTomorrowsPuzzle(provider: AIProvider = DEFAULT_PROVIDER): Promise<DailyPuzzle> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPuzzleForDate(tomorrow, provider);
}

export async function getAllPuzzleEmojis(): Promise<string[]> {
  // Get all puzzle keys from Redis
  const keys = await redis.keys('puzzle:*');
  const allEmojis: string[] = [];

  // Fetch and parse each puzzle
  for (const key of keys) {
    const puzzleData = await redis.get<DailyPuzzle>(key);
    if (puzzleData) {
      if (typeof puzzleData === 'string') {
        try {
          const parsed = JSON.parse(puzzleData);
          if (parsed?.emojis?.length) {
            allEmojis.push(...parsed.emojis);
          }
        } catch (e) {
          console.error(`Failed to parse puzzle from key ${key}:`, e);
        }
      } else if (puzzleData?.emojis?.length) {
        allEmojis.push(...puzzleData.emojis);
      }
    }
  }

  return [...new Set(allEmojis)]; // Remove duplicates
}
