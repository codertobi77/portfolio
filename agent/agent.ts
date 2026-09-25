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
  // The portfolio agent only needs authored tools (blog drafting), not
  // bash/read/write/web access. Keeps the public demo surface minimal.
  defaultTools: false,
});
