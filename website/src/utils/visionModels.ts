// Heuristic check for whether an Ollama model name belongs to a multimodal /
// vision family. The list covers the public Ollama registry as of 2026 — if
// you add a new family, drop a pattern here.
const VISION_PATTERNS: RegExp[] = [
  /llava/i,
  /bakllava/i,
  /vision/i,
  /moondream/i,
  /minicpm-?v/i,
  /granite.*vision/i,
  /qwen.*vl/i,
  /pixtral/i,
]

export function isVisionModel(name?: string | null): boolean {
  if (!name) return false
  return VISION_PATTERNS.some(p => p.test(name))
}
