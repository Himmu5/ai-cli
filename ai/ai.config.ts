import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export function getAgentModel(): LanguageModel {
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
