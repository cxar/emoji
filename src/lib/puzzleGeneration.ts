import { Redis } from '@upstash/redis';
import { DailyPuzzle, Solution } from "@/types";
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Initialize Redis and AI clients
const redis = Redis.fromEnv();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Deterministic shuffle using a seed string
function seededShuffle<T>(array: T[], seed: string): T[] {
  console.log(`Shuffling array of length ${array.length} with seed ${seed}`);
  const numbers = Array.from(seed).map(char => char.charCodeAt(0));
  let seedNumber = numbers.reduce((acc, num) => acc + num, 0);
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seedNumber = (seedNumber * 1664525 + 1013904223) % 4294967296;
    const j = seedNumber % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  console.log('Shuffle complete');
  return shuffled;
}

type AIProvider = 'claude' | 'openai';

export async function generatePuzzleWithAI(date: Date, provider: AIProvider = 'claude'): Promise<Omit<DailyPuzzle, 'id' | 'generated'>> {
  console.log(`Generating puzzle for date ${date} using provider ${provider}`);
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const systemPrompt = `You generate daily puzzles for a word association game. Each puzzle needs 16 unique emojis that form 4 groups of 4, with increasing difficulty (1-4). NO DUPLICATE EMOJIS ALLOWED.

DIFFICULTY LEVELS:
1. Clear category but interesting
2. Thematic connections requiring some thought
3. Cultural or conceptual links
4. Surprising but logical connections

LEVEL 1 EXAMPLES:
"Winged hunters" 🦅 🦇 🦉 🐝
"Desert patrol" 🦂 🦎 🐪 🦏
"Mountain crew" 🦙 🦬 🐐 🦫
"Ocean giants" 🐋 🦈 🐳 🦑
"Forest scouts" 🦊 🦝 🦡 🦘
"Garden helpers" 🌱 🪴 🪜 🚿
"Kitchen tools" 🫖 🍶 🥄 🫙
"Ancient vessels" 🏺 ⚱️ 🗿 🪬
"Spice traders" 🌶️ 🧂 🫑 🥘
"Sacred objects" 🕯️ 📿 🪬 🧿
"Royal treasures" 👑 💎 🏺 ⚜️
"Night watchers" 🦉 🌙 👁️ 🔭
"Breakfast makers" 🥚 🥞 🥓 🍳
"String players" 🎻 🪕 🎸 🪘
"Lab equipment" ⚗️ 🧪 🔬 🧫
"Medical tools" 💉 🩺 🩻 🧬
"Office supplies" 📏 ✂️ 📎 📌
"Fresh produce" 🥬 🥕 🫑 🥒
"Carnival treats" 🍭 🍿 🥨 🧁
"Winter wear" 🧤 🧣 🧥 🥾
"Farm animals" 🐄 🐖 🐑 🐓
"Building tools" 🔨 🪚 🪛 🪜
"Writing tools" ✒️ 📝 🖊️ 🖌️
"Climbing gear" 🪢 🧗 🪜 🏔️
"Tea time treats" 🫖 🍪 🍯 🥮
"Tropical fruits" 🥭 🥥 🍍 🫛
"Festival lights" 🪔 🕯️ 🔦 💡
"Baking essentials" 🥚 🧈 🥛 🧂
"Garden insects" 🐝 🐛 🦗 🐞
"Sea predators" 🦈 🦑 🐙 🦐
"Mountain tools" ⛏️ 🪜 🧭 🪢
"Desert survivors" 🦂 🦎 🐪 🌵
"Circus performers" 🤹 🎪 🎭 🦮
"Battle gear" 🗡️ 🛡️ ⚔️ 🏹
"Measurement tools" 📏 ⚖️ 🌡️ ⏱️
"Sushi ingredients" 🍚 🐟 🥢 🫘
"Camping gear" 🏕️ 🔦 🪃 🗺️
"Ice cream shop" 🍦 🍨 🧁 🥤
"Pizza toppings" 🍄 🫑 🧀 🍅
"Forest fruits" 🫐 🍇 🍓 🍒
"Pond dwellers" 🐸 🦆 🐢 🦢
"Cave creatures" 🦇 🕷️ 🦎 🐜
"Spicy things" 🌶️ 🫑 🥘 🍛
"Ocean plants" 🌊 🌿 🍄 🪸
"Playground equipment" 🎠 🎢 🎪 🎡
"Bath items" 🛁 🧴 🧼 🧽
"Outdoor sports" 🎣 ⛳ 🏹 🏄
"Construction site" 🏗️ 🚧 🪜 🏭
"Forest sounds" 🦉 🦊 🐺 🦜
"Kitchen appliances" 🔪 🫖 🍶 🥄
"Sacred space" ⛩️ 🕌 🕍 ⛪
"Sky watchers" 🔭 🛸 🛩️ 🪽
"Desert landmarks" 🏰 🗿 🕌 ️
"Winter sports" ️ 🏂 🎿 🛷
"Night sky" 🌙 ⭐ 🌠 ☄️
"Card games" 🃏 🎴 🀄 🎲
"Paint tools" 🖌️ 🎨 🖼️ 🎭
"Garden flowers" 🌸 🌹 🌺 🌻
"Castle features" 🏰 ⚔️ 👑 🛡️
"Beach essentials" 🏖️ 🧴 🕶️ ⛱️
"Breakfast drinks" ☕ 🧃 🥛 🧋
"Forest shelters" 🏕️ 🌳 🪵 🏚️
"Music makers" 🥁 🎺 🎻 🪘
"Royal court" 👑 👸 🤴 🗡️

LEVEL 2 EXAMPLES:
LEVEL 2 EXAMPLES:
"Morning wakers" 🐓 ☀️ ⏰ ☕
"Sound shapers" 🎻 🔔 📢 🗣️
"Shadow makers" 🌳 🏰 ⛅ 🌂
"Path finders" 🧭 🦮 🌟 🗺️
"Secret keepers" 🔐 📔 🤫 🎭
"Water workers" 🚣 🎣 🧜 🌊
"Sky dancers" 🪁 🦅 🎪 ✈️
"Night watchers" 🦉 🌙 👁️ 🔭
"Stone shapers" ⚒️ 🗿 🏺 💎
"Wind riders" 🪽 🎐 🪁 🌪️
"Fortune seekers" 🎲 🔮 🎯 🎰
"Earth movers" 🦬 🌋 🚜 🏗️
"Sleep bringers" 🌙 🎵 🫖 📖
"Heat makers" 🔥 🌡️ 💡 🧯
"Message senders" 🕊️ 📬 📡 🔔
"Circle drawers" 🎪 🎡 ⭕ 🔄
"Wave makers" 🌊 🎵 🎭 👋
"Bridge builders" 🌉 🤝 🔧 💕
"Door openers" 🗝️ 👋 💳 🔑
"Air movers" 💨 🌪️ 🪽 🎐
"Light bringers" 🔦 🕯️ ⚡ 🌅
"Joy spreaders" 🎪 🎨 🎵 🎈
"Ground breakers" ⛏️ 🌱 🚜 🦫
"Storm makers" 🌩️ 🌪️ 🌧️ ⛈️
"Peace keepers" 🕊️ 🛡️ 🤝 ⚖️
"Mind readers" 🔮 👁️ 🎭 📖
"Space takers" 🏰 🎪 🐘 🌳
"Wall builders" 🧱 🕸️ 🏰 🐜
"Edge walkers" 🏴‍☠️ 🎪 🧗 🕵️
"Cloud shifters" 🌪️ ✈️ 🎈 🪽
"Time watchers" ⌛ 🦉 🌙 🕰️
"Dream makers" 🛏️ 📚 🎭 🌙
"Game changers" 🎲 ⚡ 🎭 🃏
"Shell dwellers" 🐌 🐢 🦀 🐚
"Fruit lovers" 🐝 🦇 🐘 🐒
"Mountain tamers" 🧗 🦙 ⛷️ 🏔️
"Current riders" 🏄 🚣 🌊 🍃
"Fire tamers" 👨‍🚒 🧯 🚒 🧙‍♀️
"Snow shapers" ⛄ 🎿 🏂 🌨️
"Web weavers" 🕷️ 👩‍💻 📱 🕸️

LEVEL 3 EXAMPLES:
"Boundary keepers" 🚪 🗝️ 🛡️ 👁️
"Dream weavers" 🕸️ 🎭 🌌 🎪
"Truth seekers" 🔍 ⚖️ 📜 🔮
"Story guardians" 📚 🦉 🏛️ 🪔
"Fate changers" 🎲 ⚔️ 🎭 ⚡
"Sacred vessels" 🏺 👑 🔮 ⚱️
"Life cycles" 🥚 🐛 🦋 🌱
"Power symbols" ⚡ 👑 🗡️ 🔥
"Fortune's faces" 🎭 🎲 🌙 🎯
"Time keepers" ⌛ 🕰️ 🌓 🗿
"Wisdom bearers" 🦉 📚 🕯️ 🌳
"Soul guides" 🕯️ 🧭 🦋 ⭐
"Memory holders" 📱 💍 🖼️ 📓
"Victory markers" 🏆 👑 🌿 🎯
"Ancient voices" 🏺 📯 🪘 🎭
"Oracle tools" 🎴 🔮 🎲 🗿
"Sacred guardians" 🦁 🔱 🗡️ 🛡️
"Portal watchers" 🚪 🗝️ 🔮 👁️
"Balance keepers" ⚖️ 🌓 🕊️ ☯️
"Storm bringers" 🌩️ 🐉 🌪️ 👑
"Spirit vessels" 🏺 📿 🕯️ 💀
"Justice symbols" ⚖️ 👁️ ⚔️ 📜
"Destiny weavers" 🕸️ ⭐ 🎲 🔮
"Royal guards" 🦁 👑 🗡️ 🛡️
"Magic sources" 🔮 🌙 ⚡ 🪄
"Battle omens" 🦅 ⚔️ 🔥 🎭
"Peace symbols" 🕊️ 🕯️ 🌿 🤝
"Forest spirits" 🦊 🍄 🌳 🦉
"Ocean mysteries" 🌊 🐋 🧜 🌙
"Divine messengers" 👼 🕊️ ⚡ 🌟
"Fire keepers" 🔥 🕯️ 🧙‍♀️ 🏛️
"Moon children" 🐺 🦉 🌙 🧙‍♀️
"Treasure guards" 🐉 💎 🗝️ 👁️
"Path makers" 🌟 🧭 🗺️ 🦮
"Fortune's tools" 🎲 🎴 🔮 🎯
"Story weavers" 📚 🎭 🕸️ 🎨
"Temple keepers" ⛩️ 🕯️ 📿 👼
"Reality shapers" 🎭 🔮 🎨 ⚡
"Wind speakers" 🌪️ 🎐 🍃 🦅
"Earth readers" 🌱 🦉 🔮 🗿

LEVEL 4 EXAMPLES:
"Line makers" 🕷️ ✏️ ⛵ ✈️
   Each creates paths: spider webs, pencil marks, boat wakes, contrails

"Hidden builders" 🐜 🦠 🌱 🫀
   Each constructs invisibly: ant colonies, microbe communities, root systems, heart tissue

"Pattern breakers" ✂️ 🌩️ 💔 🦋
   Each disrupts existing forms: cutting, lightning strikes, heartbreak, metamorphosis

"Space makers" 📚 🪗 🎪 🌱
   Each creates room where there wasn't: books open worlds, accordion expands, tent makes shelter, seed splits earth

"Signal senders" 🌺 📡 🔔 🦜
   Each broadcasts messages: flower attracts pollinators, antenna transmits data, bell announces, bird calls

"World shapers" 🌋 🦫 👩‍🌾 🎨
   Each transforms their environment: volcanoes form land, beavers build dams, farmers cultivate, artists create

"Truth tellers" 🔬 👁️ ⚖️ 🌡️
   Each reveals reality: microscope shows tiny world, eye witnesses, scales measure truth, thermometer tells temperature

"Gap bridgers" 🌈 📞 🤝 🔑
   Each connects separated things: rainbow links sky/earth, phone connects people, handshake joins strangers, key links locked/unlocked

"Memory keepers" 📸 💍 🪦 🧬
   Each preserves what was: photos capture moments, rings symbolize promises, graves remember lives, DNA carries history

"Door makers" 🔑 🤝 📖 🎵
   Each opens new ways: key unlocks paths, handshake opens relationships, book opens minds, music opens hearts

"Circle drawers" 🌙 ⏰ 🎡 🌊
   Each creates cycles: moon phases, clock hands, Ferris wheel turns, wave patterns

"Pattern finders" 🔍 🧩 🔮 🧬
   Each reveals hidden structures: magnification, puzzle solving, divination, genetic code

"Time capturers" ⏸️ 📸 🥶 🫙
   Each freezes moments: pause button, camera, freezing, preservation

"Secret writers" 🐾 🌊 ⚡ 💉
   Each leaves meaningful marks: footprints tell stories, water shapes land, lightning scars, medical records

"Balance keepers" 🕷️ 🎭 ⚖️ 🎪
   Each maintains tension: web structure, drama conflict, justice, tightrope

"Patient catchers" 🕸️ 🎣 🪤 🎯
  Each waits for its target: spider's web, fishing line, trap, target practice

"Boundary crossers" 🚀 🔑 🦅 🧗
  Each moves between realms: space/earth, locked/unlocked, air/ground, up/down

"Story holders" 🪸 🎨 🧬 💍
  Each contains narratives: coral records ocean changes, art holds meanings, DNA holds ancestry, rings hold promises

"Rule breakers" 🌋 🦠 🎭 🃏
  Each defies expectations: volcanoes remake land, microbes evolve, actors transform, joker changes game

"Night workers" 🦉 🌙 🦊 🌺
  Each operates in darkness: owl hunts, moon pulls tides, fox prowls, night-blooming flowers

"Change markers" 📅 🍂 🌡️ 🎭
  Each signals transformation: calendar shows time, falling leaves show seasons, thermometer shows shifts, mask shows roles

"Space benders" 📚 🔭 🔍 🎪
  Each alters perception of space: books transport minds, telescope brings far close, microscope makes small big, circus defies physics

"Hidden guardians" 🔋 🧬 🌳 🛡️
  Each protects invisibly: battery stores power, DNA preserves life, roots stabilize earth, shield blocks danger

"Echo makers" 🔔 🌊 🏛️ 🎵
  Each creates lasting resonance: bell sound, ripples, architecture, music

"Power holders" ⚡ 💭 🗝️ 📝
  Each contains potential: electricity, ideas, access, written words

"Threshold guides" 🌅 🚪 🧭 🎓
  Each marks transitions: dawn to day, in to out, lost to found, student to graduate

"Code writers" 🧬 🐝 🎵 👣
  Each creates meaningful patterns: DNA, honeycomb, music notation, dance steps

"Light catchers" 📷 🌙 💎 👁️
  Each captures and transforms light: camera, moon reflection, crystal refraction, vision

"Bridge builders" 🌈 🤝 📡 🗣️
  Each connects across distance: rainbow spans sky, handshake joins people, signal connects devices, voice carries meaning

"Pattern breakers" 🌩️ 🎲 ✂️ 🦋
  Each disrupts existing order: lightning splits sky, dice change fate, scissors cut patterns, metamorphosis transforms

"Truth finders" 🔍 ⚖️ 🧪 🎭
  Each reveals reality differently: investigation, justice, experiment, dramatic truth

"Memory makers" 📸 💫 🕯️ 🎭
  Each preserves moments: photos capture time, stars show past light, candle ceremonies, theatrical recreation

"World weavers" 🕷️ 🎨 🗺️ 📚
  Each creates universes: spider's web, artist's canvas, cartographer's map, author's story

"Portal keepers" 🚪 📱 🔮 🎭
  Each opens to other realms: doorway, screen, crystal ball, performance

------ USE THE ABOVE EXAMPLES AS INSPIRATION, BUT CREATE YOUR OWN UNIQUE GROUPS. ------

FOR MORE INSIGHT, CONSIDER THE FOLLOWING WORD CATEGORIES, and apply them to emojis:
Synonyms: Words with similar meanings (e.g., happy, joyful, cheerful, merry)
Antonyms: Words with opposite meanings (e.g., hot, cold, black, white)
Categories: Words belonging to the same category (e.g., apple, banana, orange, grape)
Homophones: Words that sound alike but have different meanings (e.g., there, their, they're)
Puns/Wordplay: Words connected by a play on words (e.g., bandage, patch, fix, repair)
Shared Letters/Prefixes/Suffixes: Words sharing common letters or parts of words
Themes: Words related to a specific theme (e.g., Shakespeare, Hamlet, Macbeth, Othello)
Functions/Uses: Words sharing a similar function or purpose

CREATIVITY IS PARAMOUNT.

ABSOLUTELY NO DUPLICATE EMOJIS ALLOWED. IT IS INCREDIBLY BAD.`;

  const prompt = `Generate a puzzle for ${dateStr} for a word association game using emojis. Create themed puzzles ONLY if this is the exact date of a major holiday.

Respond with a JSON object in this format:
{
  "solutions": [
    {
      "emojis": ["emoji1", "emoji2", "emoji3", "emoji4"],
      "name": "group name",
      "difficulty": 1,
      "explanation": "Why this group works"
    }
  ]
}   

YOU MUST USE THE ABOVE FORMAT.

CREATIVITY IS THE MOST IMPORTANT PART OF THIS.
CREATE SOMETHING UNIQUE AND INSIGHTFUL.
CREATIVITY IS PARAMOUNT.
CREATE SOMETHING THAT YOU WOULD WANT TO SOLVE.
CREATE SOMETHING THAT YOU THINK IS FUN AND CREATIVE.

ONLY RESPOND WITH VALID JSON.

The solutions array must contain exactly 4 groups with difficulties 1, 2, 3, and 4.
Each emoji must appear exactly once across all groups.

ABSOLUTELY NO DUPLICATE EMOJIS ALLOWED. IT IS INCREDIBLY BAD.`;

  let responseText: string;

  if (provider === 'claude') {
    console.log('Using Claude for puzzle generation');
    const message = await anthropic.messages.create({
      model: "claude-3-5-latest",
      max_tokens: 1024,
      temperature: 1,
      system: systemPrompt,
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
    const openaiPrompt = `Generate a puzzle for ${dateStr} for a word association game using emojis. Create themed puzzles ONLY if this is the exact date of a major holiday.

Respond with a JSON object in this format:
{
  "solutions": [
    {
      "emojis": ["emoji1", "emoji2", "emoji3", "emoji4"],
      "name": "group name",
      "difficulty": 1,
      "explanation": "Why this group works"
    }
  ]
}


## Core Requirements
- Create exactly 4 groups of 4 emojis each (16 total emojis)
- Each emoji must be used exactly once (NO DUPLICATES ALLOWED)
- Each group must have a clear, defensible connection between all items
- Groups should progress from somewhat challenging to very challenging
- Simple categorical relationships are not acceptable at any level

## Difficulty Levels

### Level 1: Functional Parallels
- Items that serve similar purposes in different contexts
- Example: "Path Makers" 🕷️ ✏️ ⛵ ✈️ (each leaves trails: spider webs, pencil marks, boat wakes, contrails)
- Should require some thought but connections are discoverable

### Level 2: Process & Transformation
- Items unified by how they change or affect their environment
- Example: "Hidden Builders" 🐜 🦠 🌱 🫀 (each constructs complex systems invisibly)
- Should require understanding of how things work or behave

### Level 3: Metaphorical & Conceptual
- Items connected by abstract or symbolic relationships
- Example: "Memory Keepers" 📸 💍 🪦 🧬 (each preserves history: photos capture moments, rings symbolize promises, graves remember lives, DNA carries ancestry)
- Should require lateral thinking and cultural knowledge

### Level 4: Multi-layered Connections
- Items linked by complex, multi-step logical relationships
- Example: "Truth Tellers" 🔬 👁️ ⚖️ 🌡️ (each reveals reality but in different domains: microscope shows invisible world, eye witnesses events, scales measure objective truth, thermometer reveals hidden energy state)
- Should create an "aha moment" when the sophisticated connection is discovered

## Connection Strategies
- Look for items that create similar effects through different mechanisms
- Consider how different items might solve similar problems across scales
- Think about how items might mirror each other's behaviors in unexpected contexts
- Look for parallel processes in different domains (microscopic/macroscopic, natural/artificial)
- Consider items that serve as bridges or transformers between states
- Think about how different items preserve, transmit, or transform information

## Quality Standards
- Every group should reveal an insight about how things relate
- Connections should be specific and precise, not vague or general
- Simple category groups like "animals" or "weather" are not acceptable
- Avoid surface-level similarities (color, shape, size)
- Focus on function, process, behavior, and conceptual parallels
- All connections must be logically defensible when explained
- Holiday themes should add complexity, not reduce it

Remember: Even Level 1 should require thought - there should be no immediately obvious groupings.` 

    const completion = await openai.chat.completions.create({
      model: "o1-preview",
      temperature: 1,
      messages: [
        {
          role: "user",
          content: openaiPrompt
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