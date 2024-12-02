import { kv } from "@vercel/kv";
import { DailyPuzzle } from "@/types";

export async function getTodaysPuzzle() {
  const id = getPuzzleId();
  const puzzle = await kv.get<DailyPuzzle>(`puzzle:${id}`);

  if (!puzzle) {
    throw new Error("No puzzle found for today");
  }

  return puzzle;
  }