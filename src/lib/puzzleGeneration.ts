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

  const prompt = `
Goal:
Generate a single JSON object representing a daily emoji puzzle (using ${dateStr} for the date), featuring exactly 4 sets of 4 unique emojis each (16 total unique emojis), plus a scrambled "emojis" array. The puzzle's sets should be approachable and meaningful to a broad audience, providing a satisfying "aha" moment without requiring overly niche knowledge.
If the date is a major holiday, the puzzle should incorporate that holiday's themes & symbols.

Key Guidelines:

Wide Cultural Appeal & Familiarity:
- Choose themes that are broadly recognizable and not confined to obscure knowledge.
- Consider everyday concepts (e.g., common meals, widely recognized cultural icons), essential historical inventions, and well-known symbols across global cultures.
- Avoid sets requiring deep literary, mythological, or niche pop-culture references. Aim for concepts the "everyman" might recognize with some thought.

Balanced Difficulty Distribution:
- Difficulty 1: A theme that's moderately challenging but reasonably guessable (e.g., items one might find together in daily life, a common category of well-known foods, or widely recognized symbols).
- Difficulty 2: Slightly trickier, introducing a subtle conceptual link. For example, instruments found in a typical music group or tools from a familiar activity.
- Difficulty 3: More challenging but still accessible. This might involve common historical breakthroughs or universal concepts (like major inventions or foundational cultural elements).
- Difficulty 4: The most challenging, yet still fair and guessable. It may relate to iconic global symbols (e.g., national animals or internationally known places). The solver should need some lateral thinking, but once discovered, the link should feel rewarding and logically consistent.

Individual Emoji Relevance:
- Each emoji in a set must individually support the theme—no "filler" symbols that only make sense after the solution is known.
- For example, if the theme is "Hearty Breakfast," each emoji is a distinct, commonly recognized breakfast food; if the theme is "National Animals," each emoji directly represents an animal strongly associated with a particular country.

No Trivial or Purely Visual Categories:
- Avoid sets that are too obvious (e.g., four leaves for the four seasons) or purely based on shape/color alone.
- Try and pull from different categories of emoji. That means avoid things like "animals" or "food" categories, unless there's more than one such that guessing the theme is difficult.
- Instead, ensure each group feels like it's grounded in a meaningful concept that's recognizable and not just a pattern of shapes.

No Duplicate Emojis:
- Each of the 16 emojis must be unique across the entire puzzle.

Clear Explanations & Naming:
- The "name" of each group should make sense once the connection is understood.
- The "explanation" should confirm why these four emojis belong together, in a concise manner.

Output Format:
Return only one JSON object with the following structure (no extra text outside):
json
Copy code
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
}

Do not include any other text in your response. Do not include backticks or language identifiers like "json". Only return the JSON object.

In Summary:
Use this prompt to produce puzzles with sets similar in spirit and accessibility to the provided examples: iconic categories like "Hearty Breakfast," "Rock Band Essentials," "Pioneering Inventions," and "National Animals." Start with something a bit more obvious for difficulty 1, add some subtlety for difficulty 2, and so forth, ensuring each set is recognizable, thematically tight, and guessable with common knowledge.

ABSOLUTELY NO DUPLICATE EMOJIS ALLOWED, EITHER IN THE SAME SET OR ACROSS SETS.
`;

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
  
  // Store in Redis with 48-hour expiry
  console.log('Storing new puzzle in Redis');
  await redis.set(`puzzle:${puzzleId}`, JSON.stringify(newPuzzle), { ex: 48 * 60 * 60 });
  
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