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

  const prompt = `You are an expert Emoji Connections puzzle author AND your own validator.

INPUTS
- dateStr = "${dateStr}"
- recentEmojisStr = "${recentEmojisStr}"          // do not use any of these

GOAL
Generate **exactly one** JSON object for an Emoji Connections-style puzzle dated **${dateStr}**.

OUTPUT **ONLY** (no prose, no backticks):

{
  "solutions":[
    {"emojis":[…4…],"name":"…", "difficulty":1,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":2,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":3,"explanation":"…"},
    {"emojis":[…4…],"name":"…", "difficulty":4,"explanation":"…"}
  ],
  "emojis":[…16 scrambled…]
}

HARD RULES
1) Inventory
   • 4 groups × 4 distinct emojis ⇒ 16 unique emojis total.
   • Reject any emoji seen in recentEmojisStr.
   • No duplicates, no skin-tone modifiers, no ZWJ/gender variants, no keycap digits/letters, no tag sequences, no regional-indicator flags.
   • Prefer platform-stable glyphs (avoid highly vendor-dependent ones).

2) Holiday handling
   • Major US Holiday on dateStr? If YES, weave that holiday into *every* group's theme while keeping groups in four different domains.
   • If you cannot be certain there is a major US holiday on dateStr, assume NO.
   • Examples of "major": New Year's Day, MLK Day, Presidents' Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas.

3) Diversity & domains
   • Each group must use emojis from **≥2 Unicode sub-categories** (people, objects, food, nature, symbols, transport, activities, etc).
   • Across the whole puzzle, target **four different conceptual domains** (e.g., Food, Sports/Games, Travel/Places, Music/Media, Home/Tools, Tech/Internet, Nature/Animals, Emotions/Relationships).
   • The puzzle must **not** collapse to a single overall theme unless holiday mode is on.

4) Group design
   • Name ≤ 3 words. Explanation ≤ 15 words.
   • Connection types must be everyday U.S. knowledge (no niche trivia, no foreign-specific references).
   • Avoid flimsy links (pure look-alikes, only color/shape matches, "starts with same letter," emoji-name puns).
   • Avoid "lucky set" tropes (zodiac, four elements, four seasons) unless in holiday mode and clearly contextualized.
   • At most one "trap pair" (two emojis that *feel* like they belong elsewhere). If present, call it out in confusability notes (meta).

5) Difficulty calibration
   • difficulty=1: clear "a-ha," minimal overlap.
   • difficulty=2: mild twist or broader category, still fair.
   • difficulty=3: lateral but common concept; decoys possible but resolvable.
   • difficulty=4: hardest; still deducible without insider knowledge; no ambiguity.

6) Scrambling
   • "emojis" must be the union of all 16, **random order** (not grouped).

VALIDATION PIPELINE (must run before output)
A) Hygiene:
   - No banned or recentEmojisStr entries.
   - Exactly 16 unique emojis; each used exactly once.
   - Each group pulls from ≥2 Unicode sub-categories.

B) Domain separation:
   - Label each group's domain; all four domains must be distinct.

C) Confusability audit:
   - For every emoji, test if it could satisfy another group's rule. If yes, either:
     • strengthen that group's wording/selection, or
     • swap the emoji for a tighter fit.
   - End state: At most one intentional "trap pair" in the entire puzzle.

D) Surprise/Cleverness self-score (1–5):
   - Score each group. If any <3, regenerate that group (up to 3 attempts). If still <3, rebuild the puzzle with new concepts.

E) Cultural fairness:
   - Remove anything requiring specialized or regional knowledge outside typical U.S. familiarity.

F) Holiday check:
   - Set meta.holidayApplied accordingly.

AUTHORING TIPS (use, don't output)
- Strong categories: "Tailgate foods," "Airport hassles," "Things that buzz," "Camping gear," "Laundry day," "Headphones features," "Pets' needs," "Coffee shop items."
- To satisfy "≥2 sub-categories," mix, e.g., people + object, food + symbol, tool + place.
- Keep explanations concrete ("Items for road trips") not vague ("Things that go together").
- Favor property or frame categories over taxonomies.
  • Property: "Has a shell," "Needs charging," "Makes a sound," "Things you 'roll'."
  • Frame: "Airport hassles," "Laundry day," "Camping gear," "Road trip."
- Build decoy pressure deliberately.
  • At least 6 emojis should plausibly fit a *second* group at first glance.
  • Cap at 1 intentional trap pair; document it in meta.
- Force affordance language in explanations.
  • Use "used for…," "worn when…," "kept in…," "seen at…," not vague labels.
- Tier knobs (how to push difficulty up/down):
  • d=1: concrete frame, minimal overlap, obvious affordance.
  • d=2: broader frame or milder property; 2–3 light decoys.
  • d=3: lateral link ("press," "roll," "charge") with cross-category examples; 3–4 decoys.
  • d=4: abstract but fair affordance ("things that **flash**" vs color/shape). Decoys look right until you test the affordance.
- Ban lazy links: pure look-alikes, color-only, letter/word puns, lucky-symbol quartets.
- Sub-category mix rule stays: every group must combine ≥2 Unicode sub-categories.
- Confusability test (must pass):
  1) For each emoji, list other groups it *seems* to fit (0–2).
  2) If any emoji *actually* satisfies another group's rule → swap or tighten.
  3) End state: ≥6 "seems" hits, 0 "actually fits" errors, ≤1 trap pair.

FINAL STEP
- Produce the JSON object exactly as specified.
- No extra commentary or keys unless include_meta=true.
`;

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
      solutions: response.solutions.map(({ emojis, name, difficulty, explanation }) => ({
        emojis,
        name,
        difficulty,
        explanation,
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
