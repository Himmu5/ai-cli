import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV3 } from "@ai-sdk/provider";

export function getAgentModel(): LanguageModelV3 {
  const apiKey = process.env.OPEN_ROUTER_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_KEY environment variable is required");
  }

  const modelId = process.env.OPEN_ROUTER_DEFAULT_MODEL;
  if (!modelId) {
    throw new Error("OPEN_ROUTER_DEFAULT_MODEL environment variable is required");
  }

  const provider = createOpenRouter({ apiKey });
  return provider(modelId);
}
