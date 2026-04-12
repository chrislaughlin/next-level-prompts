import { polishMissionLineServer } from '../server/openrouter'

type GenerationHints = {
  max_new_tokens?: number
  temperature?: number
  top_p?: number
}

let lastBackend: 'openrouter' | null = null

export const DEFAULT_GENERATION_TIMEOUT_MS = 8000

export async function prefetchModel() {
  lastBackend = 'openrouter'
  return null
}

export async function isModelCached(): Promise<boolean> {
  return false
}

export async function generateClientText(prompt: string, overrides?: GenerationHints) {
  const text = await polishMissionLineServer({
    data: {
      prompt,
      overrides,
    },
  })

  if (!text?.trim()) {
    throw new Error('OpenRouter returned an empty response.')
  }

  lastBackend = 'openrouter'
  return text
}

export async function generateClientTextWithTimeout(
  prompt: string,
  overrides?: GenerationHints,
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      generateClientText(prompt, overrides),
      new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Client generation timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function forceRefetchModel() {
  return prefetchModel()
}

export function getLastBackend() {
  return lastBackend
}

export function isWebGPUPreferred() {
  return false
}
