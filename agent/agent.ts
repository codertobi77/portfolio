import { defineAgent } from "eve";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// TokenRouter: OpenAI-compatible gateway exposing GLM 5.3 (free tier).
const tokenrouter = createOpenAICompatible({
  name: "tokenrouter",
  baseURL: "https://api.tokenrouter.io/v1",
  apiKey: process.env.TOKENROUTER_API_KEY,
});

export default defineAgent({
  model: tokenrouter("z-ai/glm-5.3-free"),
  // The portfolio agent only needs authored tools (blog drafting), not
  // bash/read/write/web access. Keeps the public demo surface minimal.
  defaultTools: false,
});
