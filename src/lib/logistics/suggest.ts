import { localSuggest } from "./localSuggest";
import type { SuggestInput, Suggestion } from "./types";

/**
 * The AI booking helper. The only module that may talk to Gemini (added next); it takes SuggestInput and nothing else.
 * Falls back to the local sort whenever the model is unavailable, so booking never depends on an external service.
 */
export async function suggest(input: SuggestInput): Promise<Suggestion | null> {
  return localSuggest(input.options, input.preference);
}
