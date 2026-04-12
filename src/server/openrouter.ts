import { createServerFn } from '@tanstack/react-start'

type OpenRouterGenerationHints = {
  max_new_tokens?: number
  temperature?: number
  top_p?: number
}

type OpenRouterPolishRequest = {
  prompt: string
  overrides?: OpenRouterGenerationHints
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'minimax/minimax-m2.5:free'

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
}

function getRefererHeader() {
  const referer = process.env.OPENROUTER_SITE_URL || process.env.VITE_OPENROUTER_SITE_URL
  return referer ? { 'HTTP-Referer': referer } : {}
}

export const polishMissionLineServer = createServerFn({ method: 'POST' })
  .validator((data: OpenRouterPolishRequest) => data)
  .handler(async ({ data }) => {
    const apiKey = getOpenRouterApiKey()
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY on the server.')
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...getRefererHeader(),
        'X-Title': 'Next Level Prompts',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: data.prompt }],
        temperature: data.overrides?.temperature ?? 0.4,
        top_p: data.overrides?.top_p ?? 0.85,
        max_tokens: data.overrides?.max_new_tokens ?? 120,
      }),
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

    return text
  })
