// Curated list of Ollama models the admin can install with one click.
// Source: https://ollama.com/library — sizes are approximate and may drift
// over time as upstream re-quantizes. Update freely.

export interface AvailableModel {
  name: string
  label: string
  size: string
  ramHint: string
  description: string
  recommended?: 'low-end' | 'mid' | 'high-end'
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  {
    name: 'llama3.2:1b',
    label: 'Llama 3.2 1B',
    size: '1.3 GB',
    ramHint: '~2 GB RAM',
    description: 'Tiniest. Fast on any Mac, quality limited.',
    recommended: 'low-end',
  },
  {
    name: 'llama3.2:3b',
    label: 'Llama 3.2 3B',
    size: '2.0 GB',
    ramHint: '~4 GB RAM',
    description: 'Best balance for MacBook Air. Recommended.',
    recommended: 'low-end',
  },
  {
    name: 'gemma2:2b',
    label: 'Gemma 2 2B',
    size: '1.6 GB',
    ramHint: '~3 GB RAM',
    description: 'Google\'s small model. Great for short answers.',
    recommended: 'low-end',
  },
  {
    name: 'qwen2.5:3b',
    label: 'Qwen 2.5 3B',
    size: '1.9 GB',
    ramHint: '~4 GB RAM',
    description: 'Strong multilingual (Spanish/English).',
    recommended: 'low-end',
  },
  {
    name: 'phi3:mini',
    label: 'Phi-3 Mini',
    size: '2.3 GB',
    ramHint: '~4 GB RAM',
    description: 'Microsoft\'s reasoning-focused small model.',
    recommended: 'mid',
  },
  {
    name: 'qwen2.5:7b',
    label: 'Qwen 2.5 7B',
    size: '4.7 GB',
    ramHint: '~8 GB RAM',
    description: 'High quality multilingual. Slow on 8 GB Macs.',
    recommended: 'mid',
  },
  {
    name: 'mistral:7b',
    label: 'Mistral 7B',
    size: '4.1 GB',
    ramHint: '~8 GB RAM',
    description: 'Classic. Good general-purpose model.',
    recommended: 'mid',
  },
  {
    name: 'llama3.1:8b',
    label: 'Llama 3.1 8B',
    size: '4.7 GB',
    ramHint: '~8 GB RAM',
    description: 'Meta\'s flagship 8B. Heavy on 8 GB Macs — first response is slow.',
    recommended: 'mid',
  },
  {
    name: 'gemma2:9b',
    label: 'Gemma 2 9B',
    size: '5.4 GB',
    ramHint: '~10 GB RAM',
    description: 'Top quality at 9B. Needs 16 GB Mac for comfort.',
    recommended: 'high-end',
  },
  {
    name: 'qwen2.5-coder:7b',
    label: 'Qwen 2.5 Coder 7B',
    size: '4.4 GB',
    ramHint: '~8 GB RAM',
    description: 'Code-tuned. Use it for the "Código" category.',
    recommended: 'mid',
  },
  {
    name: 'deepseek-r1:7b',
    label: 'DeepSeek R1 7B',
    size: '4.7 GB',
    ramHint: '~8 GB RAM',
    description: 'Reasoning-tuned with chain-of-thought.',
    recommended: 'mid',
  },
  {
    name: 'llava:7b',
    label: 'LLaVA 7B (vision)',
    size: '4.7 GB',
    ramHint: '~8 GB RAM',
    description: 'Vision model. Required to use image attachments in chat.',
    recommended: 'mid',
  },
  {
    name: 'llama3.2-vision:11b',
    label: 'Llama 3.2 Vision 11B',
    size: '7.9 GB',
    ramHint: '~12 GB RAM',
    description: 'Meta\'s multimodal flagship. Best image understanding.',
    recommended: 'high-end',
  },
  {
    name: 'llama3.1:70b',
    label: 'Llama 3.1 70B',
    size: '40 GB',
    ramHint: '~48 GB RAM',
    description: 'Only for high-RAM Macs (M-Pro/Max with 64+ GB).',
    recommended: 'high-end',
  },
]
