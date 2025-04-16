import { Redis } from "@upstash/redis";
import { DailyPuzzle, Solution } from "@/types";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { seededShuffle } from "@/lib/utils";

// Initialize Redis and AI clients
const redis = Redis.fromEnv();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AIProvider = "claude" | "openai";

// Get default provider from environment variable
const DEFAULT_PROVIDER: AIProvider =
  (process.env.DEFAULT_AI_PROVIDER as AIProvider) || "openai";

export async function generatePuzzleWithAI(
  date: Date,
  provider: AIProvider = DEFAULT_PROVIDER,
): Promise<Omit<DailyPuzzle, "id" | "generated">> {
  console.log(`Generating puzzle for date ${date} using provider ${provider}`);
  console.log("Date:", date);
  const dateStr = date.toUTCString();
  console.log("Formatted date string:", dateStr);

  // Get recently used emojis
  const recentEmojis = await getAllPuzzleEmojis();
  const recentEmojisStr = recentEmojis.join(", ");

  const prompt = `
Generate **one** JSON object for an Emoji Connections‑style puzzle dated **${dateStr}**.

GENERAL RULES
• 4 groups × 4 distinct emojis ⇒ 16 unique emojis total.  
• You may not use ANY emojis from this set: [${recentEmojisStr}].  
• If there is a Major US Holiday on ${dateStr}, then weave that theme into *all* groups.  
• The puzzle, as a whole, should not be a single theme, UNLESS it is a holiday. All groups should not relate to the same theme.
• Concepts must be common U.S. knowledge, never niche, lucky‑symbol sets, pure look‑alikes, or word‑stem gimmes.  
• Each group must combine emojis from ≥2 Unicode sub‑categories (people, objects, food, nature, symbols, flags, etc).  
• Across the puzzle, groups must target **four different conceptual domains** (e.g., food, sports, travel, music).  
• Difficulty tiers 1‑4; 1 = easy “a‑ha”, 4 = hard but fair.  
• Avoid emoji connections that are too confusing or too flimsy of a connection.
• Group name ≤3 words.  Explanation ≤15 words.
• Each group must be solvable by an American audience and conceptually known to everyday Americans. That means no niche foreign concepts or references.

QUALITY GATE
After drafting, self‑score each group on a 1‑5 “surprise/cleverness” scale.  
If any <3, regenerate that group (max 3 attempts).  
Reject puzzles with dupe or banned emojis.

OUTPUT **ONLY**:

{
  "solutions":[
    {"emojis":[…4…],"name":"…", "difficulty":1,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":2,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":3,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":4,"explanation":"…"}
  ],
  "emojis":[…16 scrambled…],
}
`;

  console.log("Prompt:", prompt);

  let responseText: string;

  if (provider === "claude") {
    console.log("Using Claude for puzzle generation");
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      console.error("Unexpected non-text response from Claude");
      throw new Error("Expected text response from Claude");
    }
    responseText = content.text;
    console.log("Received response from Claude");
  } else {
    console.log("Using OpenAI for puzzle generation");
    const response = await openai.responses.create({
      model: "o4-mini", // your model
      instructions:
        "You are a master puzzle creator. Widely renowned for the high quality of every puzzle you generate.",
      input: prompt, // the same prompt you passed as messages
      reasoning: { effort: "high" },
      text: {
        format: {
          type: "json_schema",
          name: "EmojiConnectionsPuzzle",
          strict: true,
          schema: {
            type: "object",
            properties: {
              solutions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    emojis: { type: "array", items: { type: "string" } },
                    name: { type: "string" },
                    difficulty: { type: "integer", enum: [1, 2, 3, 4] },
                    explanation: { type: "string" },
                  },
                  required: ["emojis", "name", "difficulty", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["solutions"],
            additionalProperties: false,
          },
        },
      },
    });
    console.log("Raw API response:", JSON.stringify(response, null, 2));

    responseText = response.output_text;
    if (!responseText) throw new Error("Empty response content");
    console.log(responseText);
    console.log("Received response from OpenAI");
  }

  try {
    console.log("Parsing AI response");
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
      console.error("Invalid puzzle format: incorrect number of solutions");
      throw new Error("Invalid puzzle format from AI");
    }

    // Check for duplicate emojis
    const allEmojis = response.solutions.flatMap((s) => s.emojis);
    const uniqueEmojis = new Set(allEmojis);
    if (uniqueEmojis.size !== 16) {
      console.error("Duplicate emojis found in puzzle");
      throw new Error("Duplicate emojis found in puzzle");
    }

    // Check for recently used emojis
    const usedRecentEmojis = allEmojis.filter((emoji) =>
      recentEmojis.includes(emoji),
    );
    if (usedRecentEmojis.length > 0) {
      console.error("Recently used emojis found in puzzle:", usedRecentEmojis);
      throw new Error("Recently used emojis found in puzzle");
    }

    // Validate difficulty levels
    const difficulties = new Set(response.solutions.map((s) => s.difficulty));
    if (
      difficulties.size !== 4 ||
      !([1, 2, 3, 4] as const).every((d) => difficulties.has(d))
    ) {
      console.error("Invalid difficulty progression");
      throw new Error("Invalid difficulty progression");
    }

    // Use the date string as the seed for consistent shuffling
    const puzzleId = date.toISOString().split("T")[0];
    console.log(`Shuffling emojis with puzzle ID ${puzzleId}`);
    const shuffledEmojis = seededShuffle(allEmojis, puzzleId);

    return {
      solutions: response.solutions.map(({ emojis, name, difficulty }) => ({
        emojis,
        name,
        difficulty,
      })),
      emojis: shuffledEmojis,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    throw new Error("Failed to generate valid puzzle");
  }
}

export async function getPuzzleForDate(
  date: Date,
  provider: AIProvider = DEFAULT_PROVIDER,
): Promise<DailyPuzzle> {
  const puzzleId = date.toISOString().split("T")[0];
  console.log(`Getting puzzle for date ${puzzleId}`);

  // Check if puzzle exists in Redis
  console.log("Checking Redis for existing puzzle");
  const existingPuzzle = await redis.get<DailyPuzzle>(`puzzle:${puzzleId}`);
  if (existingPuzzle) {
    console.log("Found existing puzzle in Redis");
    if (typeof existingPuzzle === "string") {
      try {
        const parsed = JSON.parse(existingPuzzle);
        if (parsed?.emojis?.length) {
          console.log("Successfully parsed existing puzzle");
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse puzzle from Redis:", e);
      }
    } else if (existingPuzzle?.emojis?.length) {
      console.log("Using existing puzzle from Redis");
      return existingPuzzle;
    }
  }

  // Generate new puzzle with AI
  console.log("Generating new puzzle with AI");
  const puzzleBase = await generatePuzzleWithAI(date, provider);
  const newPuzzle: DailyPuzzle = {
    id: puzzleId,
    generated: new Date().toISOString(),
    solutions: puzzleBase.solutions,
    emojis: puzzleBase.emojis,
  };

  // Store in Redis with 7-day expiry
  console.log("Storing new puzzle in Redis");
  await redis.set(`puzzle:${puzzleId}`, JSON.stringify(newPuzzle), {
    ex: 7 * 24 * 60 * 60,
  });

  return newPuzzle;
}

export async function getTodaysPuzzle(
  provider: AIProvider = DEFAULT_PROVIDER,
): Promise<DailyPuzzle> {
  return getPuzzleForDate(new Date(), provider);
}

export async function getTomorrowsPuzzle(
  provider: AIProvider = DEFAULT_PROVIDER,
): Promise<DailyPuzzle> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPuzzleForDate(tomorrow, provider);
}

export async function getAllPuzzleEmojis(): Promise<string[]> {
  // Get all puzzle keys from Redis
  const keys = await redis.keys("puzzle:*");
  const allEmojis: string[] = [];

  // Fetch and parse each puzzle
  for (const key of keys) {
    const puzzleData = await redis.get<DailyPuzzle>(key);
    if (puzzleData) {
      if (typeof puzzleData === "string") {
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
