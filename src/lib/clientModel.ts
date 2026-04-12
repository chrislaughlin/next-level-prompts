type GenerationHints = {
  max_new_tokens?: number
  temperature?: number
  top_p?: number
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'minimax/minimax-m2.5:free'

let lastBackend: 'openrouter' | null = null

function resolveOpenRouterApiKey() {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? // @ts-expect-error vite env
        import.meta.env
      : undefined

  return (
    viteEnv?.VITE_OPENROUTER_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined) ||
    ''
  )
}

function getSiteUrlHeader() {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? // @ts-expect-error vite env
        import.meta.env
      : undefined

  return viteEnv?.VITE_OPENROUTER_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : undefined)
    ? {
        'HTTP-Referer':
          viteEnv?.VITE_OPENROUTER_SITE_URL ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
      }
    : {}
}

export const DEFAULT_GENERATION_TIMEOUT_MS = 8000

export async function prefetchModel() {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    throw new Error(
      'Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY (or OPENROUTER_API_KEY) to enable prompt polishing.',
    )
  }

  lastBackend = 'openrouter'
  return null
}

export async function isModelCached(): Promise<boolean> {
  return false
}

export async function generateClientText(prompt: string, overrides?: GenerationHints) {
  const apiKey = resolveOpenRouterApiKey()
  if (!apiKey) {
    throw new Error(
      'Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY (or OPENROUTER_API_KEY) to enable prompt polishing.',
    )
  }

  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: overrides?.temperature ?? 0.4,
    top_p: overrides?.top_p ?? 0.85,
    max_tokens: overrides?.max_new_tokens ?? 120,
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...getSiteUrlHeader(),
      'X-Title': 'Next Level Prompts',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = json.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) {
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
