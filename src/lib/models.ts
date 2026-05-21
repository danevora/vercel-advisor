export type ModelOption = {
  id: string;
  label: string;
  provider: string;
};

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', provider: 'OpenAI' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'OpenAI' },
  { id: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', provider: 'Anthropic' },
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
];

export const DEFAULT_MODEL_ID = 'openai/gpt-4o-mini';

export function isValidModel(id: string): boolean {
  return AVAILABLE_MODELS.some((m) => m.id === id);
}
