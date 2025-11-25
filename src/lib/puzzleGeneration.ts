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
  (process.env.DEFAULT_AI_PROVIDER as AIProvider) || "claude";

const CLAUDE_MODEL = "claude-opus-4-5";
const CLAUDE_TOTAL_TOKENS = 32000;
const CLAUDE_THINKING_BUDGET = CLAUDE_TOTAL_TOKENS - 4096;

async function generateClaudeText(prompt: string, model: string) {
  const stream = await anthropic.messages.create({
    model,
    max_tokens: 32000,
    thinking: { type: "enabled", budget_tokens: CLAUDE_THINKING_BUDGET },
    temperature: 1,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: true,
  });

  let text = "";
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      text += event.delta.text;
    }
  }

  if (!text) {
    throw new Error("Received empty stream from Claude");
  }

  return { text, modelUsed: model };
}

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

  const prompt = `You are an expert Emoji Connections puzzle designer.

DATE: ${dateStr}
BANNED EMOJIS (used recently): ${recentEmojisStr}

Create a puzzle with 4 groups of 4 emojis each (16 unique emojis total).

═══════════════════════════════════════
THE GOLDEN RULE
═══════════════════════════════════════

Every connection must be TESTABLE and use the SAME SENSE across all four items.

Ask yourself: "Can I apply the exact same definition/usage to all four?"

✓ "Things you peel" → 🍌🧅🍊🥔
   Test: Do you peel a banana? Yes. An onion? Yes. An orange? Yes. A potato? Yes.
   Same sense: physical removal of outer layer.

✗ "Things that attract" → 🧲🌟🏆👁️
   Magnet attracts physically. "Eyes attract attention" is metaphorical.
   FAILS: mixing literal and figurative senses.

✗ "Things you draw" → ✏️🛁🗡️🩸
   You draw WITH a pencil, not draw A pencil.
   FAILS: pencil is the tool, not the object of the verb.

═══════════════════════════════════════
CONNECTION TYPES THAT WORK
═══════════════════════════════════════

1. PHYSICAL PROPERTY (same property, testable)
   "Things with shells" → 🥚🐢🌰🦪
   "Things that melt" → 🧊🕯️🍦🧀
   "Things with stripes" → 🦓🐝🚧🎬 (zebra, bee, barrier, clapperboard)

2. CONCRETE FRAME (all LITERALLY present in scenario)
   "Camping gear" → 🏕️🔦🧭🪓
   "Found in a wallet" → 💳🪪💵🧾
   "Thanksgiving table" → 🦃🥧🌽🥔 (turkey, pie, corn, potatoes — actually served)

3. ACTION/VERB (same verb, same sense, noun is the OBJECT not the tool)
   "Things you crack" → 🥚🦴🔐💪 (crack an egg, crack a bone, crack a code, crack your knuckles)
   "Things you stuff" → 🧸🦃🫑🧦 (stuff a bear, stuff a turkey, stuff a pepper, stuff a stocking)
   "Things you draw" → 🛁🗡️🩸🎟️ (draw a bath, draw a sword, draw blood, draw a raffle winner)

4. COMPOUND PHRASES (real, common phrases only)
   "___ break" → ☕🌅💔🏖️ (coffee break, daybreak, heartbreak, spring break)
   "___ball" → 🧺👁️❄️🔮 (basketball, eyeball, snowball, crystal ball)
   "___ house" → 🐕🌳🔥👻 (doghouse, treehouse, firehouse, haunted house)

═══════════════════════════════════════
CONNECTION TYPES THAT FAIL
═══════════════════════════════════════

✗ Color/shape only: "Red things," "Round things"
✗ Vague vibes: "Summer things," "Happy things"
✗ Aesthetic association: 🍂 for "Thanksgiving table" (leaves aren't literally on the table)
✗ Homophones/puns: "filed/filleted," "knight/night"
✗ Letter tricks: "Starts with B"
✗ Mixed senses: literal + metaphorical uses of same word
✗ Tool confusion: "things you draw" with ✏️ (that's what you draw WITH)
✗ Obscure phrases: "fire dog" (most people don't know this term)

═══════════════════════════════════════
DIFFICULTY LEVELS
═══════════════════════════════════════

d=1: Obvious category, no distractions
     "Breakfast foods" → 🥞🍳🥓🧇

d=2: Broader category OR requires one small insight
     "Things that melt" → 🧊🕯️🍦🧀
     (Cheese surprises some solvers)

d=3: Lateral link, requires a mental hop
     "Things you stuff" → 🧸🦃🫑🧦
     (Stockings and peppers aren't obviously "stuffed" until you think)

d=4: Abstract but fair — solver says "ohhhh" not "that's unfair"
     "Things you draw" → 🛁🗡️🩸🎟️
     (Draw a bath, draw a sword, draw blood, draw a winner — same "pull/extract" sense)

The d=4 group must be DEDUCIBLE. If a solver can't reason their way there, it's broken.

═══════════════════════════════════════
DECOY DESIGN
═══════════════════════════════════════

A great puzzle has DECOY TENSION: emojis that seem to belong together but don't.

Example: If your groups include:
- "Things that melt" → 🧊🕯️🍦🧀
- "Birthday party" → 🎂🎈🎁🎉

Then 🕯️ creates tension — it LOOKS like birthday (candles on cake) but belongs in "melt."

Aim for 4-6 emojis that tempt solvers toward wrong groupings.

═══════════════════════════════════════
COMPLETE EXAMPLE PUZZLE
═══════════════════════════════════════

{
  "solutions": [
    {"emojis":["🥞","🍳","🥓","🧇"], "name":"Breakfast Foods", "difficulty":1, "explanation":"Foods typically eaten at breakfast"},
    {"emojis":["🧊","🕯️","🍦","🧀"], "name":"Things That Melt", "difficulty":2, "explanation":"Items that turn liquid when heated"},
    {"emojis":["🧸","🦃","🫑","🧦"], "name":"Things You Stuff", "difficulty":3, "explanation":"Stuffed bear, stuffed turkey, stuffed pepper, stuffed stocking"},
    {"emojis":["🛁","🗡️","🩸","🎟️"], "name":"Things You Draw", "difficulty":4, "explanation":"Draw a bath, draw a sword, draw blood, draw a raffle winner"}
  ],
  "emojis":["🗡️","🧊","🥓","🧸","🍳","🛁","🕯️","🦃","🧇","🩸","🫑","🍦","🎟️","🥞","🧦","🧀"]
}

DECOY ANALYSIS:
- 🕯️ looks like birthday but is in "melt"
- 🦃 looks like food but is in "stuff"
- 🧀 looks like breakfast but is in "melt"

═══════════════════════════════════════
HARD CONSTRAINTS
═══════════════════════════════════════

- 16 unique emojis, none from banned list
- No skin tones, flags, keycap digits, or ZWJ sequences
- Group names ≤ 3 words
- Explanations ≤ 15 words  
- All connections must be common U.S. knowledge (no obscure terms)
- Each group uses emojis from 2+ Unicode subcategories
- "emojis" array must be randomly shuffled (not grouped)
- For CONCRETE FRAME categories: every emoji must be LITERALLY present, not just aesthetically associated
- For VERB categories: each emoji must be the OBJECT of the verb, not the tool
- HOLIDAY HANDLING: If ${dateStr} is a widely observed US holiday (e.g., New Year’s Day, MLK Day, Presidents’ Day, Memorial Day, Independence Day, Labor Day, Halloween, Thanksgiving, Christmas, Easter, etc.), weave that holiday into all 4 groups while keeping them in four distinct domains. If not, proceed normally without holiday overlay.

OUTPUT (JSON only, no markdown fences, no commentary):
{
  "solutions":[
    {"emojis":[...4...],"name":"...","difficulty":1,"explanation":"..."},
    {"emojis":[...4...],"name":"...","difficulty":2,"explanation":"..."},
    {"emojis":[...4...],"name":"...","difficulty":3,"explanation":"..."},
    {"emojis":[...4...],"name":"...","difficulty":4,"explanation":"..."}
  ],
  "emojis":[...16 shuffled...]
}`;

  console.log("Prompt:", prompt);

  let responseText: string;

  if (provider === "claude") {
    console.log(
      `Using Claude model ${CLAUDE_MODEL} with thinking budget ${CLAUDE_THINKING_BUDGET} tokens`,
    );
    const claudeResult = await generateClaudeText(prompt, CLAUDE_MODEL);
    responseText = claudeResult.text;
    console.log(
      `Received response from Claude using model ${claudeResult.modelUsed}`,
    );
  } else {
    console.log("Using OpenAI for puzzle generation");
    const response = await openai.responses.create({
      model: "gpt-5", // your model
      instructions:
        "You are a master puzzle creator. Widely renowned for the high quality of every puzzle you generate. You particularly excel at Emoji Connections puzzles, which are a type of puzzle where players must identify groups of emojis that share a common theme or connection. This is similar to the game 'Connections' by The New York Times.",
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
