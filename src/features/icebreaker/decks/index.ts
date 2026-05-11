import firstThirtyDays from "./first-30-days.json";
import creativePairings from "./creative-pairings.json";
import theLastBug from "./the-last-bug.json";
import whatMadeYouLaugh from "./what-made-you-laugh.json";

export type Deck = {
  id: string;
  name: string;
  prompts: string[];
};

export const DECKS: Deck[] = [
  { id: "first-30-days", ...firstThirtyDays },
  { id: "creative-pairings", ...creativePairings },
  { id: "the-last-bug", ...theLastBug },
  { id: "what-made-you-laugh", ...whatMadeYouLaugh },
];

export function findDeck(id: string): Deck {
  return DECKS.find((d) => d.id === id) ?? DECKS[0]!;
}
