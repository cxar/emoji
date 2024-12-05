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

export async function generatePuzzleWithAI(date: Date, provider: AIProvider = 'openai'): Promise<Omit<DailyPuzzle, 'id' | 'generated'>> {
  console.log(`Generating puzzle for date ${date} using provider ${provider}`);
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const prompt = `
Generate a complex, intriguing emoji-based word association puzzle for the given date (${dateStr}), presented as a single JSON object. The puzzle should not be holiday-themed unless it coincides with a major holiday. It should stand independently and captivate players with unexpected yet logical connections that encourage thoughtful deduction and insight.
If the date is a major holiday, the puzzle should be themed around that holiday.

Requirements:
Overall Structure:
• Provide exactly 4 sets of 4 unique emojis (16 total unique emojis).
• Collect all 4 sets into a "solutions" array within a single JSON object. For example:

{
  "solutions": [
    {
      "emojis": ["emoji1", "emoji2", "emoji3", "emoji4"],
      "name": "Group 1", 
      "difficulty": 1,
      "explanation": "Explanation for group 1."
    },
    {
      "emojis": ["emoji5", "emoji6", "emoji7", "emoji8"],
      "name": "Group 2",
      "difficulty": 2,
      "explanation": "Explanation for group 2."
    },
    {
      "emojis": ["emoji9", "emoji10", "emoji11", "emoji12"],
      "name": "Group 3",
      "difficulty": 3,
      "explanation": "Explanation for group 3."
    },
    {
      "emojis": ["emoji13", "emoji14", "emoji15", "emoji16"],
      "name": "Group 4",
      "difficulty": 4,
      "explanation": "Explanation for group 4."
    }
  ]
}

• Respond only with the JSON object containing all four sets, with no additional text outside the JSON object.

Conceptual Guidelines:
• Each set must have a distinct, meaningful connection—cultural, conceptual, symbolic, linguistic, or functional—but not an obvious or cliché category.
• Choose connections that feel naturally satisfying and elegant once revealed.
• Consider diverse approaches:

Employ subtle symbolic or metaphoric resonances that bridge natural phenomena, technology, art, or science.
Use linguistic twists or homophones, either within a single language or bridging familiar words in multiple languages.
Highlight lesser-known scientific or cultural concepts that can be inferred through patterns or recognizable traits (e.g., behaviors of certain animals, properties of materials, conceptual groupings from widely known yet not overly common knowledge areas).
Integrate thematic patterns that reward curiosity and lateral thinking, prompting players to connect different domains meaningfully rather than rely on obscure trivia.

Aim for each successive set to be more challenging:
• Difficulty 1 (Moderately Challenging): A subtle but discernible link that most solvers can find with a bit of thought, rather than instantly.
• Difficulty 2 (More Challenging): A concept that is still accessible but demands more pattern recognition or a small leap of insight.
• Difficulty 3 (Even More Challenging): A thematic or symbolic connection that requires stepping back to see a bigger picture or recognizing an overarching idea.
• Difficulty 4 (Similar to Difficulty 3): Similar to difficulty 3.

Quality & Creativity:
• Avoid trivial sets (e.g., all fruits, the four cardinal directions).
• Avoid sets that rely on rarefied or arcane knowledge that can't be reasonably deduced. Instead, aim for connections that are "hidden in plain sight," revealed through thoughtful observation.
• The explanation for each set should be concise, illuminating the exact nature of the link and confirming why these emojis form a coherent group.
• Encourage variety in emoji choice: mix objects, symbols, animals, cultural icons, technological elements, and natural phenomena.
• Strive for an overall puzzle that feels like a journey, with each successive set drawing the solver deeper into creative and conceptual thinking.

When deciding, sometimes go with your 3rd or 4th choice to introduce a bit of variety.

Each component of the set should apply to the overall theme of that set, without needing to be in context with the other emojis.

Think really really hard about the theme of each set, by looking at the emojis and thinking about what they have in common.

Final Output:
• Return only the single JSON object containing all four sets following the structure above.
• Ensure that the chosen connections and their explanations create a sense of discovery and enjoyment for the solver.
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

export async function getPuzzleForDate(date: Date, provider: AIProvider = 'claude'): Promise<DailyPuzzle> {
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

export async function getTodaysPuzzle(provider: AIProvider = 'claude'): Promise<DailyPuzzle> {
  return getPuzzleForDate(new Date(), provider);
}

export async function getTomorrowsPuzzle(provider: AIProvider = 'claude'): Promise<DailyPuzzle> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPuzzleForDate(tomorrow, provider);
}