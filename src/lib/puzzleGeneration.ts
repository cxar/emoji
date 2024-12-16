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
Generate a single JSON object representing a daily emoji puzzle. The puzzle date is indicated by ${dateStr}. The puzzle must contain exactly **4 distinct sets** of **4 unique emojis each**, for a total of **16 unique emojis**. Additionally, provide a scrambled \`"emojis"\` array containing all 16 emojis in a random order. Each set of 4 emojis must connect to a meaningful theme, and the puzzle should feel fresh and surprising, yet solvable with common knowledge.

**IMPORTANT - DO NOT USE THESE EMOJIS:**
The following emojis have been used in recent puzzles and should NOT be used again:
${recentEmojisStr}

**Holiday Integration:**  
- If ${dateStr} corresponds exactly to a major global holiday (e.g., December 25 for Christmas), incorporate that holidays well-known symbols or themes into at least one of the sets.

**Cultural Accessibility & Broad Recognizability:**  
- Select concepts and themes that are broadly known around the world or recognizable through common education, media exposure, or everyday life.
- Avoid niche references that would require specialized knowledge (e.g., very obscure historical figures, highly local traditions, or small fandom references).
- Consider everyday categories (e.g., home appliances, widely known events, simple cultural symbols) or iconic global items (e.g., famous landmarks, universally recognized mythological creatures, basic scientific concepts).

**Difficulty & Thematic Diversity:**  
- The 4 sets should vary in difficulty:
  - **Difficulty 1 (Easy):** A slightly challenging but straightforward category. For instance, items from a standard part of daily life, recognizable symbols, or something slightly playful yet not too obscure.
  - **Difficulty 2 (Moderate):** A subtle conceptual link. Possibly everyday objects tied by a less obvious theme (e.g., tools for a specific but commonly known activity, common items from a shared cultural practice).
  - **Difficulty 3 (Challenging):** More abstract or conceptual, yet still guessable. Could be historical breakthroughs, universally known archetypes, or foundational cultural elements.
  - **Difficulty 4 (Hard):** The trickiest and most clever set, but still grounded in recognizable concepts. This might involve a lateral connection (e.g., symbolic representations of something non-obvious) that, once realized, feels satisfying.

**Quality of Sets & Emojis:**  
- **No filler emojis:** Each chosen emoji must individually contribute to the theme. If the theme is "iconic breakfast foods," each emoji should represent a well-known breakfast item without requiring a stretch in logic.
- **Avoid purely visual or trivial links:** Don't rely on simple color matches or shape-based connections. The connection should be conceptually meaningful, not just aesthetic.
- **Avoid overly obvious single-category sets:** A set shouldn't just be four animals or four fruits unless there's a meaningful twist. For instance, four animals that are national symbols of different countries, or four fruits strongly tied to a cultural event, could be acceptable. Aim for conceptual depth.
- **Diversify emoji choices:** Use emojis from different categories (animals, objects, symbols, people, places, events). Don't group four similar emojis from the same subset (e.g., four sports balls). Strive for variety and uniqueness to increase the puzzle's interest and complexity.
- **No duplicates:** Ensure no emoji is repeated in any of the four sets or in the overall puzzle. All 16 emojis must be unique.

**Clarity in Naming & Explanation:**  
- Each set should have a clear, concise title ("name") that makes sense once the solver has discovered the connection.
- Provide a brief but solid 'explanation' for why these four emojis belong together. This helps confirm the solver's guess and should make sense immediately.

**JSON Output Format Only:**  
Your final response must be **only one JSON object** with this structure and no extra commentary or formatting outside the JSON:

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
  "emojis": ["emoji1", "emoji2", ... "emoji16"]
}

**No Additional Text:**  
Do not include any other text, markdown formatting, or commentary outside of the single JSON object.

**In Summary:**  
- Aim for freshness, creativity, and thematic variety.
- Ensure each set's connection is logical and discoverable.
- Use broad cultural references, everyday concepts, or iconic symbols.
- Make each difficulty level distinct.
- Do not repeat emojis.
- Do NOT use any of the recently used emojis listed above.
- Present only the required JSON object as output.
`;

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
