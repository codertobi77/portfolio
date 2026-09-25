import { defineAgent } from "eve";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// NVIDIA NIM (build.nvidia.com): OpenAI-compatible endpoint serving
// GLM 5.3 (free tier).
const nim = createOpenAICompatible({
  name: "nvidia-nim",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

export default defineAgent({
  model: nim("z-ai/glm-5.3"),
  // GLM 5.3 on NIM serves a 1,048,576-token context (NVIDIA model card).
  // Declared explicitly: the AI Gateway catalog has no metadata for this
  // custom provider, so `eve build` cannot resolve it on its own.
  modelContextWindowTokens: 1_048_576,
  // The portfolio agent only needs authored tools (blog drafting), not
  // bash/read/write/web access. Keeps the public demo surface minimal.
  defaultTools: false,
});
